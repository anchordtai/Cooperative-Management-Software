import React from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Container, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Brand from '../components/Brand';

const faqs = [
  ['How do I add members?', 'Register the cooperative and verify your email. Add a member in the workspace, set the membership to Active and send a sign-in invitation.'],
  ['How do members apply for a loan?', 'An administrator sets the annual flat interest rate. Members can review the rate and submit a request from their own account. An authorised officer reviews the application.'],
  ['How are transfers recorded?', 'Staff with the appropriate permissions can record deposits, withdrawals, disbursements and repayments after confirming the transfer separately.'],
  ['Can I export an activity report?', 'Yes. Open Reports, select a 3-, 6- or 12-month period and export completed financial activity as CSV.']
];

export default function FAQ() {
  return (
    <Container component="main" maxWidth="md" sx={{ py: 5 }}>
      <Stack spacing={3}>
        <Brand />
        <Typography component="h1" variant="h4">Frequently asked questions</Typography>
        <div>{faqs.map(([question, answer]) => (
          <Accordion key={question} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography fontWeight={650}>{question}</Typography></AccordionSummary>
            <AccordionDetails><Typography color="text.secondary">{answer}</Typography></AccordionDetails>
          </Accordion>
        ))}</div>
      </Stack>
    </Container>
  );
}
