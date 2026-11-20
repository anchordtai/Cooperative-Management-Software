import React from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import ArrowOutwardRounded from '@mui/icons-material/ArrowOutwardRounded';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined';
import RequestQuoteOutlined from '@mui/icons-material/RequestQuoteOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { brand } from '../brand';
import ProductPreview from '../components/marketing/ProductPreview';
import { SiteFooter, SiteHeader } from '../components/marketing/SiteChrome';
import { questions } from './FAQ';

const capabilities = [
  { title: 'Member management', description: 'Onboard members, approve membership and maintain a cooperative membership register.', icon: GroupsOutlined },
  { title: 'Savings and contributions', description: 'Record savings deposits and withdrawals, review requests and give members a clear view of their balance.', icon: AccountBalanceWalletOutlined },
  { title: 'Loan management', description: 'Review applications, approve loans, record disbursements and track partial or full repayments.', icon: RequestQuoteOutlined, preview: true },
  { title: 'Financial management', description: 'Keep financial records together with transaction references, paired postings and downloadable receipts.', icon: CheckCircleOutlineRounded },
  { title: 'Payment management', description: 'Record confirmed external transfers and track deposits, disbursements and repayments by their references.', icon: PaymentsOutlined },
  { title: 'Reports and analytics', description: 'Review transaction activity, trace financial decisions and export cooperative records for reporting.', icon: InsightsOutlined, preview: true },
  { title: 'Member portal', description: 'Give members access to their own savings, loan schedules, receipts and statements.', icon: PersonOutlineRounded },
  { title: 'Security and accountability', description: 'Control access with staff permissions and review an audit history of key decisions and postings.', icon: VerifiedUserOutlined },
  { title: 'Cooperative administration', description: 'Configure cooperative settings, invite officers and decide which actions each staff role can take.', icon: ManageAccountsOutlined }
];

const steps = [
  ['Set up your cooperative', 'Register your organisation and configure your workspace and staff access.'],
  ['Register members', 'Add and approve members, then invite them into their own accounts.'],
  ['Manage financial operations', 'Record savings, withdrawals, loans and repayments with clear references.'],
  ['Monitor and grow', 'Use your dashboard, activity reports and statements to review progress.']
];

const benefits = ['Less time maintaining spreadsheets', 'Clearer savings and repayment records', 'Easier member access to statements', 'Better visibility for cooperative officers'];

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion();
  return <motion.div className={className} initial={reduceMotion ? false : { opacity: 0, y: 22 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.14 }}
    transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay }}>{children}</motion.div>;
}

export default function LandingPage() {
  return <div className="cs-site">
    <a className="cs-skip" href="#main-content">Skip to content</a>
    <SiteHeader />
    <main id="main-content">
      <section className="cs-hero">
        <div className="cs-container cs-hero-inner">
          <div className="cs-hero-copy">
            <p className="cs-kicker cs-hero-enter"><span /> {brand.tagline}</p>
            <h1 className="cs-hero-enter">Your Cooperative.<br />Smarter. Stronger.<br /><em>Connected.</em></h1>
            <p className="cs-hero-description cs-hero-enter">Manage members, savings, loans, repayments and financial records from one cooperative workspace.</p>
            <div className="cs-actions cs-hero-enter">
              <Link className="cs-button cs-button-primary" to="/register">Get Started <ArrowForwardRounded /></Link>
              <a className="cs-button cs-button-glass" href="#features">Explore the Platform</a>
            </div>
          </div>
          <div className="cs-hero-visual cs-hero-enter">
            <ProductPreview />
            <div className="cs-floating" aria-hidden="true"><span><VerifiedUserOutlined /></span><div><b>Role-based access</b><small>Permissions and audit history</small></div></div>
          </div>
        </div>
      </section>
      <section className="cs-benefit-strip" aria-label="Platform capabilities">
        <Reveal className="cs-container cs-strip-inner">
          <span><GroupsOutlined /> Organised membership</span>
          <span><RequestQuoteOutlined /> Traceable transactions</span>
          <span><InsightsOutlined /> Clear financial reporting</span>
          <span><VerifiedUserOutlined /> Controlled staff access</span>
        </Reveal>
      </section>

      <section className="cs-section cs-solutions cs-container" id="solutions">
        <Reveal className="cs-section-heading">
          <span className="cs-eyebrow">THE COOPERATIVE WORKSPACE</span>
          <h2>Leave manual cooperative management behind.</h2>
          <p>Bring scattered records, financial activity and member enquiries into one shared workspace. Give your team a clear process for approvals and reporting.</p>
        </Reveal>
        <div className="cs-solution-grid">
          <Reveal className="cs-solution-photo">
            <img src="/brand/cooperative-team.webp" alt="Cooperative officers reviewing records together" loading="lazy" width="1200" height="800" />
          </Reveal>
          <Reveal className="cs-solution-list" delay={0.1}>
            <h3>Built to help your cooperative thrive.</h3>
            <p>Spend less time reconciling separate files and more time serving members.</p>
            <ul>{benefits.map(benefit => <li key={benefit}><CheckCircleOutlineRounded /> {benefit}</li>)}</ul>
            <Link className="cs-text-link" to="/about">About Co-opSphere <ArrowOutwardRounded /></Link>
          </Reveal>
        </div>
      </section>

      <section className="cs-section cs-feature-section" id="features">
        <div className="cs-container">
          <Reveal className="cs-section-heading"><span className="cs-eyebrow">PLATFORM FEATURES</span><h2>Everything your officers use, in one workspace.</h2><p>Manage member access and follow each financial record from the original request to the final report.</p></Reveal>
          <div className="cs-feature-grid">
            {capabilities.map(({ title, description, icon: Icon, preview }, index) => <Reveal key={title} className={index === 2 ? 'cs-feature cs-feature-focus' : 'cs-feature'} delay={(index % 3) * 0.07}>
              <div className="cs-feature-icon"><Icon /></div><h3>{title}</h3><p>{description}</p>
              {preview && <a className="cs-text-link" href="#dashboard-preview">Explore the dashboard <ArrowForwardRounded /></a>}
            </Reveal>)}
          </div>
        </div>
      </section>

      <section className="cs-section cs-container" id="dashboard-preview">
        <div className="cs-showcase">
          <Reveal className="cs-showcase-copy"><span className="cs-eyebrow">INTERACTIVE PREVIEW</span><h2>See what’s happening across your cooperative.</h2><p>Switch between the overview, savings and loans to see how financial activity can be presented. All figures are illustrative.</p><Link className="cs-text-link" to="/login">Open your workspace <ArrowOutwardRounded /></Link></Reveal>
          <Reveal className="cs-showcase-window" delay={0.08}><ProductPreview interactive /></Reveal>
        </div>
      </section>

      <section className="cs-section cs-steps" id="how-it-works">
        <div className="cs-container">
          <Reveal className="cs-section-heading"><span className="cs-eyebrow">HOW IT WORKS</span><h2>From setup to your first report.</h2></Reveal>
          <ol className="cs-step-grid">{steps.map(([title, description], index) => <li key={title}>
            <Reveal delay={index * 0.07}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{description}</p></Reveal>
          </li>)}</ol>
        </div>
      </section>

      <section className="cs-security">
        <div className="cs-container cs-security-inner">
          <Reveal><span className="cs-eyebrow">SECURITY AND ACCOUNTABILITY</span><h2>Your cooperative’s data deserves the highest level of care.</h2><p>Manage who can view and act on cooperative records. Follow an audit history for key staff and financial actions.</p></Reveal>
          <Reveal className="cs-security-list" delay={0.08}><VerifiedUserOutlined /><ul><li>Role-based permissions</li><li>Cooperative-scoped records</li><li>Verification and session controls</li><li>Audit history for key actions</li></ul></Reveal>
        </div>
      </section>

      <section className="cs-section cs-container cs-faq-section" id="faq">
        <Reveal className="cs-section-heading"><span className="cs-eyebrow">FAQ</span><h2>Common questions.</h2><p>Learn what the platform does and how to get started.</p></Reveal>
        <div className="cs-faq">
          {questions.map(({ question, answer }, index) => <Accordion disableGutters elevation={0} key={question} className="cs-faq-item">
            <AccordionSummary expandIcon={<ExpandMoreRounded />} id={`landing-question-${index}`} aria-controls={`landing-answer-${index}`}>{question}</AccordionSummary>
            <AccordionDetails>{answer}</AccordionDetails>
          </Accordion>)}
        </div>
      </section>

      <section className="cs-container cs-conversion">
        <Reveal className="cs-conversion-inner"><span className="cs-eyebrow">READY TO MODERNISE YOUR COOPERATIVE?</span>
          <h2>It’s time to transform the way your cooperative operates.</h2>
          <p>Bring members, savings, loans and financial records together with Co-opSphere.</p>
          <div className="cs-actions"><Link className="cs-button cs-button-primary" to="/register">Get Started Today <ArrowForwardRounded /></Link><Link className="cs-button cs-button-glass" to="/contact?topic=demo">Request a Demo</Link><Link className="cs-contact-link" to="/contact">Contact Our Team</Link></div>
        </Reveal>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
