import { useMemo } from 'react';
import { Tree } from 'antd';
import {
  BankOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  TeamOutlined
} from '@ant-design/icons';
import type { AntTreeNodeProps } from 'antd/es/tree';
import {
  PAYROLL_COMPANY_NAME,
  PAYROLL_COMPANY_ROOT_ID,
  buildDepartmentTree,
  type PayrollDepartment,
  type PayrollDepartmentTreeNode
} from '../services/payrollStaff';

type TreeNode = {
  key: string;
  title: string;
  children?: TreeNode[];
  isCompany?: boolean;
};

type PayrollDepartmentSidebarProps = {
  departments: PayrollDepartment[];
  selectedId: string;
  onSelect: (departmentId: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onEditDepartments: () => void;
  readOnly?: boolean;
};

function mapDeptTree(dept: PayrollDepartmentTreeNode): TreeNode {
  return {
    key: dept.id,
    title: dept.name,
    children: dept.children?.length ? dept.children.map(mapDeptTree) : undefined
  };
}

function buildTreeData(departments: PayrollDepartment[]): TreeNode[] {
  const tree = buildDepartmentTree(departments);
  return [
    {
      key: PAYROLL_COMPANY_ROOT_ID,
      title: PAYROLL_COMPANY_NAME,
      isCompany: true,
      children: tree.map(mapDeptTree)
    }
  ];
}

function renderTreeIcon(nodeProps: AntTreeNodeProps) {
  const node = nodeProps.data as TreeNode | undefined;
  if (node?.isCompany) {
    return (
      <span className="payroll-dept-tree__icon payroll-dept-tree__icon--company" aria-hidden>
        <BankOutlined />
      </span>
    );
  }
  return (
    <span className="payroll-dept-tree__icon payroll-dept-tree__icon--dept" aria-hidden>
      <TeamOutlined />
    </span>
  );
}

export default function PayrollDepartmentSidebar({
  departments,
  selectedId,
  onSelect,
  collapsed,
  onCollapsedChange,
  onEditDepartments,
  readOnly = false
}: PayrollDepartmentSidebarProps) {
  const treeData = useMemo(() => buildTreeData(departments), [departments]);
  const expandedKeys = useMemo(
    () => [PAYROLL_COMPANY_ROOT_ID, ...departments.map((item) => item.id)],
    [departments]
  );

  if (collapsed) {
    return (
      <aside className="payroll-staff-panel__aside payroll-staff-panel__aside--collapsed">
        <button
          type="button"
          className="payroll-staff-panel__aside-toggle"
          aria-label="展开部门树"
          onClick={() => onCollapsedChange(false)}
        >
          <DoubleRightOutlined />
        </button>
      </aside>
    );
  }

  return (
    <aside className="payroll-staff-panel__aside">
      <div className="payroll-staff-panel__aside-head">
        <span className="payroll-staff-panel__aside-title">部门</span>
        {!readOnly ? (
          <button type="button" className="payroll-staff-panel__aside-edit" onClick={onEditDepartments}>
            编辑
          </button>
        ) : null}
        <button
          type="button"
          className="payroll-staff-panel__aside-toggle"
          aria-label="收起部门树"
          onClick={() => onCollapsedChange(true)}
        >
          <DoubleLeftOutlined />
        </button>
      </div>
      <div className="payroll-staff-panel__aside-tree">
        <Tree
          blockNode
          showIcon
          defaultExpandAll
          expandedKeys={expandedKeys}
          className="payroll-dept-tree"
          treeData={treeData}
          icon={renderTreeIcon}
          selectedKeys={[selectedId || PAYROLL_COMPANY_ROOT_ID]}
          onSelect={(keys) => {
            const nextId = keys[0];
            if (typeof nextId === 'string') onSelect(nextId);
          }}
        />
      </div>
    </aside>
  );
}
