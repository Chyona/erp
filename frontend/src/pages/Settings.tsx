import { useEffect, useState } from 'react';
import { Button, Form, Input, Select, Typography, App, Card, Popconfirm, Space, Table } from 'antd';
import { ErpApi } from '../services/erpApi';
import { Voucher } from '../services/voucher';
import { TaxDeclaration } from '../services/taxDeclaration';
import { formatQuarterLabel } from '../utils/reportPeriod';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const FIELDS = [
  'companyName',
  'companyTaxId',
  'companyAddress',
  'fiscalYearStart',
  'defaultSignatory'
];

export default function Settings() {
  const { message } = App.useApp();
  const { setCompanyName, refresh, refreshKey } = useApp();
  const { can } = useAuth();
  const [form] = Form.useForm();
  const [deleteVoucherNo, setDeleteVoucherNo] = useState('');
  const [declaredQuarters, setDeclaredQuarters] = useState<
    Awaited<ReturnType<typeof TaxDeclaration.getDeclaredQuarters>>
  >([]);
  const allowed = can('settings');

  const loadDeclaredQuarters = async () => {
    setDeclaredQuarters(await TaxDeclaration.getDeclaredQuarters());
  };

  useEffect(() => {
    if (!allowed) return;
    loadDeclaredQuarters();
  }, [refreshKey, allowed]);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const all = await ErpApi.getAll('settings');
      const map = new Map(all.map((s) => [s.key, s.value]));
      const values: Record<string, string> = {};
      for (const f of FIELDS) {
        values[f] = String(map.get(f) ?? '');
      }
      if (!values.defaultSignatory) {
        values.defaultSignatory =
          String(map.get('defaultPreparedBy') ?? '') ||
          String(map.get('defaultReviewedBy') ?? '') ||
          '';
      }
      form.setFieldsValue(values);
    })();
  }, [form, allowed]);

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  const handleSave = async (values) => {
    const signatory = (values.defaultSignatory || '').trim();
    const items = [
      ...FIELDS.map((f) => ({ key: f, value: (values[f] || '').trim() })),
      { key: 'defaultPreparedBy', value: signatory },
      { key: 'defaultReviewedBy', value: signatory }
    ];
    await ErpApi.setSettingsBatch(items);
    await ErpApi.addAuditLog('修改', '系统设置', '企业信息更新');
    setCompanyName(values.companyName || '');
    message.success('设置已保存');
    refresh();
  };

  return (
    <div>
      <Form form={form} layout="vertical" onFinish={handleSave} style={{ maxWidth: 720 }}>
        <Card title="企业信息" style={{ marginBottom: 16 }}>
          <Form.Item
            name="companyName"
            label="企业名称"
            rules={[{ required: true, message: '请填写企业名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="companyTaxId" label="统一社会信用代码">
            <Input placeholder="91XXXXXXXXXXXXXX" />
          </Form.Item>
          <Form.Item name="fiscalYearStart" label="会计年度起始月">
            <Select
              options={[
                { value: '1', label: '1月' },
                { value: '4', label: '4月' }
              ]}
            />
          </Form.Item>
          <Form.Item name="companyAddress" label="企业地址">
            <Input />
          </Form.Item>
        </Card>

        <Button type="primary" htmlType="submit">
          保存设置
        </Button>
      </Form>

      <Card title="凭证维护" style={{ maxWidth: 720, marginTop: 24 }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          按凭证字号删除本地数据（含已结项凭证及附件），删除后不可恢复。
        </Typography.Paragraph>
        <Space.Compact style={{ width: '100%', maxWidth: 420 }}>
          <Input
            placeholder="例如：记-001"
            value={deleteVoucherNo}
            onChange={(e) => setDeleteVoucherNo(e.target.value.trim())}
            onPressEnter={() => document.getElementById('settings-delete-voucher-btn')?.click()}
          />
          <Popconfirm
            title="确定删除该凭证？"
            description={
              deleteVoucherNo
                ? `将永久删除凭证 ${deleteVoucherNo} 及其附件。`
                : '请先输入凭证字号'
            }
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            disabled={!deleteVoucherNo}
            onConfirm={async () => {
              try {
                await Voucher.removeByVoucherNo(deleteVoucherNo);
                message.success(`凭证 ${deleteVoucherNo} 已删除`);
                setDeleteVoucherNo('');
                refresh();
              } catch (err) {
                message.error(err.message);
              }
            }}
          >
            <Button id="settings-delete-voucher-btn" danger disabled={!deleteVoucherNo}>
              删除凭证
            </Button>
          </Popconfirm>
        </Space.Compact>
      </Card>

      <Card title="已申报季度" style={{ maxWidth: 720, marginTop: 24 }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          已申报的季度数据不可增删改、不可反结转。仅在确需更正时可取消申报标记。
        </Typography.Paragraph>
        <Table
          size="small"
          bordered
          rowKey="periodKey"
          pagination={false}
          locale={{ emptyText: '暂无已申报季度' }}
          dataSource={declaredQuarters}
          columns={[
            {
              title: '季度',
              dataIndex: 'periodKey',
              render: (_, record) => formatQuarterLabel(record.year, record.quarter)
            },
            {
              title: '申报时间',
              dataIndex: 'declaredAt',
              render: (value: string) => new Date(value).toLocaleString('zh-CN')
            },
            {
              title: '操作',
              width: 120,
              render: (_, record) => (
                <Popconfirm
                  title="取消申报标记？"
                  description={`取消后 ${formatQuarterLabel(record.year, record.quarter)} 将可再次修改凭证和反结转。`}
                  okText="确认取消"
                  cancelText="保留"
                  onConfirm={async () => {
                    try {
                      await TaxDeclaration.unmarkQuarterDeclared({
                        type: 'quarter',
                        year: record.year,
                        quarter: record.quarter
                      });
                      message.success('已取消申报标记');
                      await loadDeclaredQuarters();
                      refresh();
                    } catch (err) {
                      message.error((err as Error).message);
                    }
                  }}
                >
                  <Button type="link" danger size="small">
                    取消标记
                  </Button>
                </Popconfirm>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}
