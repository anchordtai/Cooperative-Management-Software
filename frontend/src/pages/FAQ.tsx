import React from 'react';
import { Container, Typography, Accordion, AccordionSummary, AccordionDetails, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const faqs = [
  {
    q: 'How do I onboard my cooperative members?',
    a: 'E-Cooperative lets you import members in bulk or add them individually. Members receive an invite to set up their profile and can start saving or requesting loans immediately.'
  },
  {
    q: 'Can I automate member contributions and loan repayments?',
    a: 'Yes! Our platform supports automated reminders, payment tracking, and reconciliation for both savings and loans.'
  },
  {
    q: 'Is my cooperative\'s data secure?',
    a: 'Absolutely. We use bank-level encryption, regular security audits, and role-based access to keep your data safe.'
  },
  {
    q: 'Can I generate reports for my cooperative?',
    a: 'Yes, you can generate, export, and share detailed financial and member activity reports with a single click.'
  },
  {
    q: 'What support do you offer?',
    a: 'We offer email, chat, and phone support depending on your plan. Our help center and community forum are available to all users.'
  },
];

const FAQ: React.FC = () => {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" align="center" gutterBottom fontWeight={700} color="primary">
        Frequently Asked Questions
      </Typography>
      <Box mt={4}>
        {faqs.map((faq, idx) => (
          <Accordion key={idx} sx={{ mb: 2, borderRadius: 2, boxShadow: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">{faq.q}</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography>{faq.a}</Typography>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Container>
  );
};

export default FAQ; 