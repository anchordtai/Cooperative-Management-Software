import React from 'react';
import { Link } from 'react-router-dom';
import { brand } from '../brand';
import { SiteFooter, SiteHeader } from '../components/marketing/SiteChrome';

const policies = {
  terms: {
    title: 'Terms and Conditions',
    draft: true,
    sections: [
      ['Who provides Co-opSphere?', `${brand.owner} owns and provides Co-opSphere. The applicable agreement or order should identify the contracting parties, service terms and any charges.`],
      ['Account and cooperative responsibilities', 'Cooperatives are responsible for the accuracy of their member records, decisions to grant access, approvals and financial entries. Each user should keep their credentials secure and report suspected misuse through their cooperative or the contact page.'],
      ['Financial operations', 'Co-opSphere helps cooperatives manage and document their activities. Cooperatives remain responsible for their funds, financial decisions, regulatory obligations and any independent payment or settlement arrangements.'],
      ['Your records and service access', 'Each cooperative retains ownership and control of its data and organisational records, subject to applicable law and contractual terms. Licence scope, fees, retention, cancellation and other service commitments should be set out in the applicable agreement.']
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    draft: true,
    sections: [
      ['Information used by the platform', 'Account details, contact information, membership records and cooperative financial activity are used to provide the relevant workspace. The platform also handles information generated when users authenticate, submit forms or take recorded administrative actions.'],
      ['How information is used', 'Co-opSphere uses this information to operate accounts, support financial and membership workflows, record administrative actions and respond to enquiries. Hosting, database, email and configured payment providers may process information needed for their respective services.'],
      ['Your cooperative’s role', 'Your cooperative manages its member records and decides who may access its workspace. The applicable agreement should explain the responsibilities of the cooperative and Mega Stride Technologies Limited, including retention and deletion arrangements.'],
      ['Requests and enquiries', 'For questions about a cooperative membership record, start with your cooperative. For questions about Co-opSphere or the handling of your information, use the contact page.']
    ]
  },
  'intellectual-property': {
    title: 'Software Ownership and Intellectual Property Notice',
    draft: false,
    sections: [
      ['Software and brand', `${brand.name} is a proprietary cooperative management software solution owned and developed by ${brand.owner}. This ownership covers the proprietary software, source code, product identity, branding and proprietary platform components, subject to applicable third-party licences and other rights.`],
      ['Third-party rights', 'Third-party libraries and integrations remain subject to their respective licences and rights. Any rights to use Co-opSphere are governed by the applicable agreement and licences.'],
      ['Cooperative data and assets', 'Cooperative organisations retain ownership and control of their own data and organisational records, subject to applicable law and contractual terms. Co-opSphere software ownership confers no ownership of cooperative funds, savings, contributions or financial assets.']
    ]
  },
  'acceptable-use': {
    title: 'Acceptable Use Policy',
    draft: true,
    sections: [
      ['Authorised access', 'Use your own account and access only the records your cooperative has authorised you to use. Protect passwords and verification codes.'],
      ['Respect for members and records', 'Use member information for authorised cooperative purposes. Do not impersonate another user, falsify records, submit unlawful content, or use the service to harass or defraud others.'],
      ['Service integrity', 'Do not interfere with the service, attempt to bypass access controls, introduce malicious code or obtain another organisation’s information. Report suspected misuse through your cooperative or the contact page.']
    ]
  }
} as const;

export type Policy = keyof typeof policies;

function InformationPage({ title, label, children }: { title: string; label: string; children: React.ReactNode }) {
  return <div className="cs-site">
    <SiteHeader />
    <main className="cs-content">
      <span className="cs-eyebrow">{label}</span>
      <h1>{title}</h1>
      {children}
    </main>
    <SiteFooter />
  </div>;
}

export function About() {
  return <InformationPage title="About Co-opSphere" label="COMPANY">
    <p>Co-opSphere is a modern cooperative management platform designed to simplify the administration and financial operations of cooperative societies, credit unions, staff cooperatives, thrift organisations, and member-based financial institutions.</p>
    <p>Owned and developed by {brand.owner}, Co-opSphere brings membership, savings, loans, repayments, reporting, recorded payments and cooperative administration into one workspace. The broader product scope includes contributions, shares and accounting.</p>
    <h2>Our mission</h2>
    <p>Empower cooperative organisations with secure, reliable, and accessible technology that improves operational efficiency, financial transparency, accountability, and member experience.</p>
    <h2>Our vision</h2>
    <p>Become a trusted digital operating platform for cooperative organisations across Africa and the global cooperative ecosystem.</p>
    <h2>Product ownership</h2>
    <p>{brand.name} is a proprietary cooperative management software solution owned and developed by {brand.owner}.</p>
    <Link className="cs-text-link" to="/intellectual-property">Read the software ownership notice</Link>
  </InformationPage>;
}

export function Legal({ policy }: { policy: Policy }) {
  const { title, draft, sections } = policies[policy];
  return <InformationPage title={title} label={brand.name.toUpperCase()}>
    {draft && <p className="cs-note">Draft for review. The applicable service agreement governs current use.</p>}
    <p>{brand.ownership}</p>
    {sections.map(([heading, description]) => <section key={heading}><h2>{heading}</h2><p>{description}</p></section>)}
    <Link className="cs-text-link" to="/contact">Contact Co-opSphere</Link>
  </InformationPage>;
}
