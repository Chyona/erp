import { ErpApi } from './erpApi';

const SETTING_KEY = 'payrollOrg';

export const PAYROLL_COMPANY_ROOT_ID = '__company__';
export const PAYROLL_COMPANY_NAME = '公司';

export type PayrollDepartment = {
  id: string;
  name: string;
  parentId?: string;
  enabled?: boolean;
  remark?: string;
};

export type PayrollStaffType = 'employee' | 'temporary';

export const PAYROLL_STAFF_TYPE_LABELS: Record<PayrollStaffType, string> = {
  employee: '雇员',
  temporary: '临时'
};

export type PayrollStaffMember = {
  id: string;
  name: string;
  departmentId: string;
  employeeNo?: string;
  staffType?: PayrollStaffType;
  gender?: 'male' | 'female';
  phone?: string;
  idNumber?: string;
  enabled?: boolean;
  /** @deprecated use enabled */
  status?: 'active' | 'left';
  remark?: string;
};

export type PayrollOrgData = {
  departments: PayrollDepartment[];
  staff: PayrollStaffMember[];
};

export type PayrollDepartmentTreeNode = PayrollDepartment & {
  children?: PayrollDepartmentTreeNode[];
  depth: number;
};

function normalizeDepartment(department: PayrollDepartment): PayrollDepartment {
  return {
    ...department,
    parentId: department.parentId || PAYROLL_COMPANY_ROOT_ID,
    enabled: department.enabled !== false,
    remark: department.remark?.trim() || ''
  };
}

function normalizeStaff(member: PayrollStaffMember): PayrollStaffMember {
  const enabled =
    member.enabled !== undefined ? member.enabled !== false : member.status !== 'left';
  return {
    ...member,
    employeeNo: member.employeeNo?.trim() || '',
    staffType: member.staffType === 'temporary' ? 'temporary' : 'employee',
    phone: member.phone?.trim() || '',
    idNumber: member.idNumber?.trim() || '',
    remark: member.remark?.trim() || '',
    enabled,
    status: enabled ? 'active' : 'left'
  };
}

async function readOrg(): Promise<PayrollOrgData> {
  const raw = await ErpApi.getSetting(SETTING_KEY);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { departments: [], staff: [] };
  }
  const data = raw as PayrollOrgData;
  return {
    departments: (Array.isArray(data.departments) ? data.departments : []).map(normalizeDepartment),
    staff: (Array.isArray(data.staff) ? data.staff : []).map(normalizeStaff)
  };
}

async function writeOrg(data: PayrollOrgData) {
  await ErpApi.setSetting(SETTING_KEY, data);
}

function isCompanyRoot(id: string | undefined) {
  return !id || id === PAYROLL_COMPANY_ROOT_ID;
}

export function getDepartmentLevelLabel(depth: number) {
  if (depth <= 0) return '公司';
  if (depth === 1) return '一级部门';
  if (depth === 2) return '二级部门';
  if (depth === 3) return '三级部门';
  return `${depth}级部门`;
}

export function buildDepartmentTree(departments: PayrollDepartment[]): PayrollDepartmentTreeNode[] {
  const byParent = new Map<string, PayrollDepartment[]>();
  for (const dept of departments) {
    const parentId = dept.parentId || PAYROLL_COMPANY_ROOT_ID;
    const bucket = byParent.get(parentId) || [];
    bucket.push(dept);
    byParent.set(parentId, bucket);
  }

  const visit = (parentId: string, depth: number): PayrollDepartmentTreeNode[] =>
    (byParent.get(parentId) || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      .map((dept) => ({
        ...dept,
        depth,
        children: visit(dept.id, depth + 1)
      }));

  return visit(PAYROLL_COMPANY_ROOT_ID, 1);
}

export function flattenDepartmentTree(nodes: PayrollDepartmentTreeNode[]): PayrollDepartmentTreeNode[] {
  const rows: PayrollDepartmentTreeNode[] = [];
  const walk = (items: PayrollDepartmentTreeNode[]) => {
    for (const item of items) {
      rows.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(nodes);
  return rows;
}

export function collectDepartmentTreeKeys(nodes: PayrollDepartmentTreeNode[]): string[] {
  const keys: string[] = [];
  const walk = (items: PayrollDepartmentTreeNode[]) => {
    for (const item of items) {
      keys.push(item.id);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(nodes);
  return keys;
}

export function getDepartmentDescendantIds(
  departments: PayrollDepartment[],
  rootId: string
): Set<string> {
  if (isCompanyRoot(rootId)) {
    return new Set(departments.map((item) => item.id));
  }

  const byParent = new Map<string, string[]>();
  for (const dept of departments) {
    const parentId = dept.parentId || PAYROLL_COMPANY_ROOT_ID;
    const bucket = byParent.get(parentId) || [];
    bucket.push(dept.id);
    byParent.set(parentId, bucket);
  }

  const ids = new Set<string>([rootId]);
  const walk = (id: string) => {
    for (const childId of byParent.get(id) || []) {
      ids.add(childId);
      walk(childId);
    }
  };
  walk(rootId);
  return ids;
}

export const PayrollStaff = {
  async getAll(): Promise<PayrollOrgData> {
    return readOrg();
  },

  async saveDepartment(department: PayrollDepartment) {
    const org = await readOrg();
    const name = department.name.trim();
    if (!name) throw new Error('请输入部门名称');

    const parentId = department.parentId || PAYROLL_COMPANY_ROOT_ID;
    if (department.id && department.id === parentId) {
      throw new Error('上级部门不能是自己');
    }

    const item = normalizeDepartment({
      ...department,
      id: department.id || ErpApi.generateId(),
      name,
      parentId
    });

    const duplicate = org.departments.find(
      (d) => d.name === name && d.parentId === parentId && d.id !== item.id
    );
    if (duplicate) throw new Error('同级已存在同名部门');

    const idx = org.departments.findIndex((d) => d.id === item.id);
    if (idx >= 0) org.departments[idx] = item;
    else org.departments.push(item);

    await writeOrg(org);
    await ErpApi.addAuditLog('保存', '工资部门', item.name);
    return item;
  },

  async removeDepartment(id: string) {
    const org = await readOrg();
    if (org.departments.some((d) => (d.parentId || PAYROLL_COMPANY_ROOT_ID) === id)) {
      throw new Error('请先删除下级部门');
    }
    if (org.staff.some((s) => s.departmentId === id)) {
      throw new Error('该部门下还有职员，请先调整或删除职员');
    }
    const target = org.departments.find((d) => d.id === id);
    org.departments = org.departments.filter((d) => d.id !== id);
    await writeOrg(org);
    if (target) {
      await ErpApi.addAuditLog('删除', '工资部门', target.name);
    }
  },

  async saveStaff(member: PayrollStaffMember) {
    const org = await readOrg();
    const name = member.name.trim();
    if (!name) throw new Error('请输入职员姓名');
    if (!member.departmentId) throw new Error('请选择所属部门');
    if (!org.departments.some((d) => d.id === member.departmentId)) {
      throw new Error('所属部门不存在');
    }

    const item = normalizeStaff({
      ...member,
      id: member.id || ErpApi.generateId(),
      name,
      departmentId: member.departmentId,
      staffType: member.staffType === 'temporary' ? 'temporary' : 'employee',
      gender: member.gender,
      phone: member.phone?.trim() || '',
      idNumber: member.idNumber?.trim() || '',
      enabled: member.enabled !== false,
      remark: member.remark?.trim() || ''
    });

    const idx = org.staff.findIndex((s) => s.id === item.id);
    if (idx >= 0) org.staff[idx] = item;
    else org.staff.push(item);

    await writeOrg(org);
    await ErpApi.addAuditLog('保存', '工资职员', item.name);
    return item;
  },

  async removeStaff(id: string) {
    const org = await readOrg();
    const target = org.staff.find((s) => s.id === id);
    org.staff = org.staff.filter((s) => s.id !== id);
    await writeOrg(org);
    if (target) {
      await ErpApi.addAuditLog('删除', '工资职员', target.name);
    }
  },

  async removeStaffMany(ids: string[]) {
    if (!ids.length) return;
    const org = await readOrg();
    const idSet = new Set(ids);
    const removed = org.staff.filter((item) => idSet.has(item.id));
    org.staff = org.staff.filter((item) => !idSet.has(item.id));
    await writeOrg(org);
    for (const item of removed) {
      await ErpApi.addAuditLog('删除', '工资职员', item.name);
    }
  }
};
