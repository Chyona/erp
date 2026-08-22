import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, List } from 'antd';
import { Voucher } from '../services/voucher';
import VoucherTable from '../components/VoucherTable';
import VoucherDetailModal from '../components/VoucherDetailModal';
import WorkbenchPanel from '../components/WorkbenchPanel';
import { useAsyncLoading } from '../hooks/useAsyncLoading';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

const TIPS = [
  '每笔业务必须附有原始凭证（发票、收据、合同等），并在凭证中上传附件留存',
  '借贷必须平衡，摘要应清晰描述业务实质，便于税务人员理解',
  '凭证一经审核结项，不可修改，仅可查看和打印',
  '定期使用「备份数据」导出 JSON 文件，异地保存以防数据丢失',
  '会计科目应与企业实际使用的科目表保持一致'
];

export default function Dashboard() {
  const { refreshKey } = useApp();
  const { can } = useAuth();
  const [stats, setStats] = useState({ total: 0, month: 0, totalDebit: 0, totalAttachments: 0 });
  const [recent, setRecent] = useState([]);
  const [viewId, setViewId] = useState(null);
  const { loading: pageLoading, run: runPageLoad } = useAsyncLoading(true);

  const loadDashboard = async () => {
    await runPageLoad(async () => {
      const s = await Voucher.getStats();
      const all = await Voucher.getAll();
      setStats(s);
      setRecent(all.slice(0, 8));
    });
  };

  useEffect(() => {
    loadDashboard();
  }, [refreshKey]);

  return (
    <div>
      <Title level={2}>工作台</Title>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card loading={pageLoading}>
            <Statistic title="凭证总数" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card loading={pageLoading}>
            <Statistic title="本月凭证" value={stats.month} />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card loading={pageLoading}>
            <Statistic title="借方合计" value={stats.totalDebit} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card loading={pageLoading}>
            <Statistic title="附件总数" value={stats.totalAttachments} />
          </Card>
        </Col>
      </Row>

      {can('closing.view') ? <WorkbenchPanel readOnly={!can('closing')} /> : null}

      <Card title="最近凭证" style={{ marginBottom: 20 }} loading={pageLoading}>
        <VoucherTable vouchers={recent} compact loading={pageLoading} onView={setViewId} />
      </Card>

      <Card title="税务查账合规提示" className="tips-panel">
        <List
          size="small"
          dataSource={TIPS}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>

      <VoucherDetailModal
        voucherId={viewId}
        open={!!viewId}
        onClose={() => setViewId(null)}
        onVoucherChange={setViewId}
        navigationIds={recent.map((v) => v.id)}
      />
    </div>
  );
}
