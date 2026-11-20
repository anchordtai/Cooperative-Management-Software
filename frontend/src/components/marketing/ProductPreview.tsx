import React, { useState } from 'react';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import TrendingUp from '@mui/icons-material/TrendingUp';
import { brand } from '../../brand';

const previews = {
  Overview: {
    metrics: [['Total members', '248'], ['Total savings', '₦12.8m'], ['Active loans', '34'], ['Outstanding', '₦2.4m']],
    title: 'Savings activity', subtitle: 'Monthly deposits and withdrawals',
    chart: [[43, 25], [56, 38], [49, 30], [70, 31], [75, 48], [86, 42]],
    rows: [['Savings deposit', 'Savings', '+₦65,000'], ['Loan repayment', 'Loans', '+₦48,500'], ['Savings withdrawal', 'Savings', '−₦22,000']]
  },
  Savings: {
    metrics: [['Total deposits', '₦12.8m'], ['Withdrawals', '₦1.2m'], ['Active savers', '212'], ['Pending requests', '4']],
    title: 'Savings activity', subtitle: 'Monthly deposits and withdrawals',
    chart: [[31, 12], [44, 21], [53, 19], [62, 32], [72, 45], [92, 40]],
    rows: [['Savings deposit', 'Posted', '+₦65,000'], ['Savings deposit', 'Posted', '+₦39,000'], ['Withdrawal request', 'Pending', '−₦22,000']]
  },
  Loans: {
    metrics: [['Active loans', '34'], ['Outstanding', '₦2.4m'], ['Repaid this month', '₦488k'], ['Pending approvals', '6']],
    title: 'Loan activity', subtitle: 'Monthly repayments and disbursements',
    chart: [[28, 34], [40, 30], [52, 46], [58, 37], [70, 53], [84, 60]],
    rows: [['Loan repayment', 'Posted', '+₦48,500'], ['Loan disbursement', 'Posted', '−₦120,000'], ['Loan repayment', 'Posted', '+₦31,500']]
  }
};

type PreviewTab = keyof typeof previews;
const sections = ['Overview', 'Savings', 'Loans'] as const;
const metricsIcons = [GroupsOutlined, AccountBalanceWalletOutlined, ReceiptLongOutlined, TrendingUp];
const months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];

export default function ProductPreview({ interactive = false }: { interactive?: boolean }) {
  const [tab, setTab] = useState<PreviewTab>('Overview');
  const view = previews[tab];
  return <div className="cs-preview" aria-label="Co-opSphere sample dashboard">
    <div className="cs-preview-top">
      <div className="cs-preview-brand"><img src={brand.logo.icon} alt="" width="22" height="22" /> {brand.name}</div>
      <span className="cs-preview-sample">Illustrative data</span>
    </div>
    <div className="cs-preview-body">
      <div className="cs-preview-head">
        <div><div className="cs-preview-crumb"><DashboardOutlined /> Workspace / {tab}</div><h3>{tab === 'Overview' ? 'Cooperative overview' : `${tab} overview`}</h3></div>
        <div className="cs-preview-period">Jun – Nov 2026</div>
      </div>
      {interactive && <div className="cs-preview-tabs" role="group" aria-label="Dashboard preview sections">
        {sections.map(section => <button type="button" key={section} aria-pressed={tab === section} onClick={() => setTab(section)}>{section}</button>)}
      </div>}
      <div className="cs-preview-metrics">
        {view.metrics.map(([label, value], index) => {
          const Icon = metricsIcons[index];
          return <div key={label}><Icon /><span>{label}</span><strong>{value}</strong></div>;
        })}
      </div>
      <div className="cs-preview-chart" key={tab}>
        <div className="cs-preview-chart-title"><div><b>{view.title}</b><span>{view.subtitle}</span></div><div className="cs-legend">
          <span><i /> {tab === 'Loans' ? 'Repayments' : 'Deposits'}</span>
          <span><i /> {tab === 'Loans' ? 'Disbursements' : 'Withdrawals'}</span>
        </div></div>
        <div className="cs-bars" role="img" aria-label={`${view.subtitle}, illustrative figures for June to November`}>
          {view.chart.map(([blue, mint], i) => <div className="cs-bar-column" key={months[i]}>
            <div className="cs-bar-pair">
              <i style={{ height: `${blue}%`, animationDelay: `${i * 55}ms` }} />
              <i style={{ height: `${mint}%`, animationDelay: `${i * 55 + 70}ms` }} />
            </div><span>{months[i]}</span>
          </div>)}
        </div>
      </div>
      <div className="cs-preview-ledger"><b>Recent transactions</b>
        {view.rows.map(([label, category, amount], i) => <div className="cs-preview-row" key={label + i}>
          <span><ReceiptLongOutlined /> {label}</span><span>{category}</span><strong>{amount}</strong>
        </div>)}
      </div>
    </div>
  </div>;
}
