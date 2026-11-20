import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { SiteFooter, SiteHeader } from '../components/marketing/SiteChrome';
import { brand } from '../brand';

export const questions = [
  { question: 'What is Co-opSphere?', answer: 'Co-opSphere is a digital workspace for managing a cooperative’s membership, savings, loans and financial operations.' },
  { question: 'Who can use Co-opSphere?', answer: 'Cooperative societies, staff cooperatives, thrift organisations, credit unions and other member-based organisations can use the platform.' },
  { question: 'How do I manage cooperative members?', answer: 'Add members in the workspace, approve their membership and invite them to sign in.' },
  { question: 'Can it manage savings and contributions?', answer: 'The current platform records savings deposits and withdrawals and provides savings statements. Dedicated contribution products are planned.' },
  { question: 'Can it manage loans and repayments?', answer: 'Yes. Officers can review loan requests, record disbursements, see schedules and record partial or full repayments.' },
  { question: 'Can members access their accounts on mobile?', answer: 'Yes. Members can sign in on a mobile browser to review their account, savings, loans and available statements.' },
  { question: 'How can my cooperative get started?', answer: 'Register your cooperative, verify your email and sign in. From the workspace you can configure settings and invite staff and members.' },
  { question: 'How are transfers recorded?', answer: 'Staff with the appropriate permissions can record deposits, withdrawals, disbursements and repayments after confirming the transfer separately.' },
  { question: 'Can I export an activity report?', answer: 'Yes. Open Reports, select a 3-, 6- or 12-month period and export completed financial activity as CSV.' },
  { question: 'Who owns Co-opSphere?', answer: `${brand.name} is owned and developed by ${brand.owner}.` }
];

export default function FAQ() {
  return <div className="cs-site">
    <SiteHeader />
    <main className="cs-content">
      <h1>Frequently asked questions</h1>
      <div className="cs-faq">
        {questions.map(({ question, answer }, index) => <Accordion key={question} disableGutters elevation={0} className="cs-faq-item">
          <AccordionSummary expandIcon={<ExpandMoreRounded />} id={`faq-question-${index}`} aria-controls={`faq-answer-${index}`}>{question}</AccordionSummary>
          <AccordionDetails>{answer}</AccordionDetails>
        </Accordion>)}
      </div>
    </main>
    <SiteFooter />
  </div>;
}
