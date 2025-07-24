import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Container, Grid, Avatar, useTheme, Link, IconButton, Drawer, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { Link as RouterLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SecurityIcon from '@mui/icons-material/Security';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import InstagramIcon from '@mui/icons-material/Instagram';

const brandLogos = ['A', 'B', 'C', 'D', 'E', 'F'];

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'FAQs', href: '/faq', isRoute: true },
  { label: 'Coopify+', href: '/#coopifyplus' },
  { label: 'Contact', href: '/contact', isRoute: true },
];

const Navbar: React.FC = () => {
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  return (
    <AppBar position="sticky" color="default" elevation={2} sx={{ bgcolor: 'white' }}>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          <img src="/logo.png" alt="E-Cooperative Logo" style={{ height: 48, marginRight: 12 }} />
          <Typography variant="h6" fontWeight={700} color="primary" sx={{ letterSpacing: 1 }}>
            E-Cooperative
          </Typography>
        </Box>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, alignItems: 'center' }}>
          {navLinks.map((link) =>
            link.isRoute ? (
              <Link key={link.label} component={RouterLink} to={link.href} underline="none" color="text.primary" sx={{ fontWeight: 500, fontSize: 16 }}>
                {link.label}
              </Link>
            ) : (
              <Link key={link.label} href={link.href} underline="none" color="text.primary" sx={{ fontWeight: 500, fontSize: 16 }}>
                {link.label}
              </Link>
            )
          )}
          <Button color="primary" variant="contained" component={RouterLink} to="/login" sx={{ ml: 2, fontWeight: 700 }}>
            Log in
          </Button>
        </Box>
        <Box sx={{ display: { xs: 'flex', md: 'none' } }}>
          <IconButton onClick={() => setDrawerOpen(true)}>
            <MenuIcon />
          </IconButton>
        </Box>
        <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <Box sx={{ width: 220, mt: 2 }}>
            <List>
              {navLinks.map((link) =>
                link.isRoute ? (
                  <ListItem button key={link.label} component={RouterLink} to={link.href} onClick={() => setDrawerOpen(false)}>
                    <ListItemText primary={link.label} />
                  </ListItem>
                ) : (
                  <ListItem button key={link.label} component="a" href={link.href} onClick={() => setDrawerOpen(false)}>
                    <ListItemText primary={link.label} />
                  </ListItem>
                )
              )}
              <ListItem button component={RouterLink} to="/login" onClick={() => setDrawerOpen(false)}>
                <ListItemText primary="Log in" />
              </ListItem>
            </List>
          </Box>
        </Drawer>
      </Toolbar>
    </AppBar>
  );
};

const heroVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

// Add floating and rotation animation variants for the images
const floatVariants = (delay = 0, rotate = 0) => ({
  initial: { opacity: 0, y: 0, rotate },
  animate: {
    opacity: 1,
    y: [0, -18, 0, 18, 0],
    rotate: [rotate, rotate + 6, rotate, rotate - 6, rotate]
  },
  transition: {
    duration: 5,
    repeat: Infinity,
    repeatType: "loop" as const,
    delay,
    ease: "easeInOut"
  }
});

const LandingPage: React.FC = () => {
  const theme = useTheme();
  // Update pricing plans
  const pricing = [
    {
      name: 'Starter',
      price: '₦0/mo',
      features: [
        'Up to 20 members',
        'Basic member management',
        'Savings & loan tracking',
        'Email support',
        'Community resources',
      ],
      highlight: false,
    },
    {
      name: 'Growth',
      price: '₦9,500/mo',
      features: [
        'Up to 200 members',
        'All Starter features',
        'Automated notifications',
        'Advanced analytics dashboard',
        'Role-based access control',
        'Priority email & chat support',
      ],
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      features: [
        'Unlimited members',
        'All Growth features',
        'Custom integrations',
        'Dedicated account manager',
        'On-premise or cloud hosting',
        '24/7 phone support',
      ],
      highlight: false,
    },
  ];

  // Update FAQs
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

  // Update testimonials
  const testimonials = [
    {
      name: 'Aisha Bello',
      text: 'E-Cooperative has made managing our 150+ members effortless. The automated reminders and real-time reports are a game changer!',
      org: 'Sunrise Multipurpose Cooperative',
    },
    {
      name: 'Chukwudi Okafor',
      text: 'We moved from spreadsheets to E-Cooperative and never looked back. Our members love the transparency and mobile access.',
      org: 'Unity Staff Cooperative',
    },
    {
      name: 'Ngozi Umeh',
      text: 'The support team is fantastic and the platform is always improving. Highly recommended for any cooperative!',
      org: 'Progressive Women\'s Thrift',
    },
  ];

  const features = [
    {
      icon: <MonetizationOnIcon color="primary" />, 
      title: 'Automated Savings & Contributions',
      desc: 'Members can save, contribute, and pay dues online or in-person, with instant reconciliation and automated reminders.'
    },
    {
      icon: <PeopleIcon color="primary" />, 
      title: 'Member Self-Service Portal',
      desc: 'Members access their statements, request loans, update profiles, and track their cooperative activity from any device.'
    },
    {
      icon: <GroupWorkIcon color="primary" />, 
      title: 'Loan Management & Approvals',
      desc: 'Streamline loan applications, approvals, and disbursements with customizable workflows and eligibility checks.'
    },
    {
      icon: <AssessmentIcon color="primary" />, 
      title: 'Real-Time Analytics & Reports',
      desc: 'Visualize savings, loans, and member growth. Export reports for meetings, compliance, and stakeholders.'
    },
    {
      icon: <SecurityIcon color="primary" />, 
      title: 'Bank-Grade Security & Compliance',
      desc: 'Your data is protected with encryption, audit logs, and role-based access. Stay compliant with local regulations.'
    },
    {
      icon: <LocationCityIcon color="primary" />, 
      title: 'Multi-Branch & Multi-Role Support',
      desc: 'Manage multiple branches and assign custom roles (admin, treasurer, auditor, etc.) for granular control.'
    },
  ];
  return (
    <>
      <Navbar />
      {/* Hero Section */}
      <Box sx={{ position: 'relative', bgcolor: 'white', pt: 10, pb: 8, minHeight: { xs: 500, md: 600 }, overflow: 'hidden' }}>
        {/* Animated background shape */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.15, scale: 1 }}
          transition={{ duration: 1.2 }}
          style={{
            position: 'absolute',
            top: '-10%',
            left: '-10%',
            width: '120%',
            height: '120%',
            background: `radial-gradient(circle at 60% 40%, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 60%, transparent 100%)`,
            zIndex: 0,
            borderRadius: '50%',
          }}
        />
        {/* Decorative floating images inside the gradient */}
        <motion.img
          src="/coporative.jpeg"
          alt="Cooperative 1"
          style={{ position: 'absolute', top: 60, left: 60, width: 170, height: 170, borderRadius: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', zIndex: 1 }}
          variants={floatVariants(0.2, -10)}
          initial="initial"
          animate="animate"
          whileHover={{ scale: 1.12, boxShadow: '0 0 32px 8px rgba(33,150,243,0.18)' }}
        />
        <motion.img
          src="/coporative2.jpeg"
          alt="Cooperative 2"
          style={{ position: 'absolute', top: 100, right: 100, width: 150, height: 150, borderRadius: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', zIndex: 1 }}
          variants={floatVariants(0.5, 12)}
          initial="initial"
          animate="animate"
          whileHover={{ scale: 1.12, boxShadow: '0 0 32px 8px rgba(33,150,243,0.18)' }}
        />
        <motion.img
          src="/coporative3.jpeg"
          alt="Cooperative 3"
          style={{ position: 'absolute', bottom: 100, left: 100, width: 150, height: 150, borderRadius: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', zIndex: 1 }}
          variants={floatVariants(0.8, -8)}
          initial="initial"
          animate="animate"
          whileHover={{ scale: 1.12, boxShadow: '0 0 32px 8px rgba(33,150,243,0.18)' }}
        />
        <motion.img
          src="/coporative4.jpeg"
          alt="Cooperative 4"
          style={{ position: 'absolute', bottom: 60, right: 60, width: 180, height: 180, borderRadius: 32, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', zIndex: 1 }}
          variants={floatVariants(1.1, 8)}
          initial="initial"
          animate="animate"
          whileHover={{ scale: 1.12, boxShadow: '0 0 32px 8px rgba(33,150,243,0.18)' }}
        />
        {/* Main hero content remains unchanged */}
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 2 }}>
          <motion.div initial="hidden" animate="visible" variants={heroVariants}>
            <Typography variant="h2" fontWeight={800} gutterBottom sx={{ color: 'primary.main', textAlign: 'center', fontSize: { xs: 36, md: 56 } }}>
              Cooperative Management <br /> simplified
            </Typography>
            <Typography variant="h5" mb={4} sx={{ textAlign: 'center', color: 'text.secondary', maxWidth: 700, mx: 'auto' }}>
              Minimize the paper work and stress involved with running a cooperative. E-Cooperative allows you to control members, contribution information, loan disbursement and investment portfolios all from one place.
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.7 }}>
                <Button size="large" variant="contained" color="primary" component={RouterLink} to="/register" sx={{ fontWeight: 700, px: 4, py: 1.5, fontSize: 20 }}>
                  Create Cooperative/Association Account
                </Button>
              </motion.div>
            </Box>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.7 }}>
              <Typography variant="subtitle1" mb={2} sx={{ textAlign: 'center', color: 'text.secondary' }}>Trusted By Over 500 Cooperatives</Typography>
              <Grid container spacing={2} justifyContent="center">
                {brandLogos.map((b, i) => (
                  <Grid item key={i}><Avatar sx={{ bgcolor: 'grey.200', color: 'primary.main', width: 56, height: 56, fontWeight: 700 }}>{b}</Avatar></Grid>
                ))}
              </Grid>
            </motion.div>
          </motion.div>
        </Container>
      </Box>

      {/* Features Section */}
      <Container sx={{ py: 8 }}>
        <Typography variant="h4" align="center" fontWeight={700} gutterBottom>
          The Only App You Will Need
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Box sx={{ textAlign: 'center', py: 3, minHeight: 200, bgcolor: 'grey.100', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>{feature.icon}</Box>
                <Typography variant="h6" fontWeight={700} mt={2}>{feature.title}</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>{feature.desc}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Analytics/Reporting Section */}
      <Box sx={{ bgcolor: 'grey.100', py: 8 }}>
        <Container>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.img
                  src="/analytics2.jpeg"
                  alt="Advanced Analytics Illustration"
                  style={{ maxWidth: '100%', height: 320, borderRadius: 20, objectFit: 'cover', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  whileHover={{ scale: 1.04 }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                Real-Time Cooperative Insights
              </Typography>
              <Typography variant="body1" mb={2}>
                Instantly visualize your cooperative's financial health with interactive dashboards. Track member contributions, loan repayments, and savings growth in real time. Identify trends, monitor compliance, and make data-driven decisions to maximize your cooperative's impact.
              </Typography>
              <List>
                <ListItem><ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon><ListItemText primary="Live financial overview: savings, loans, and contributions" /></ListItem>
                <ListItem><ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon><ListItemText primary="Member engagement and activity tracking" /></ListItem>
                <ListItem><ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon><ListItemText primary="Automated compliance and reporting tools" /></ListItem>
                <ListItem><ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon><ListItemText primary="Exportable, shareable reports for stakeholders" /></ListItem>
              </List>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Mobile App Section */}
      <Container sx={{ py: 8 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.img
                src="/mobile.jpeg"
                alt="Mobile App Illustration"
                style={{ maxWidth: '100%', height: 240, borderRadius: 16, objectFit: 'cover', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                whileHover={{ scale: 1.04 }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Use Your Android or iOS Device
            </Typography>
            <Typography variant="body1" mb={2}>
              Manage everything on the go. Full analytics, settings, member management, and notifications—all from your mobile device.
            </Typography>
            {/* Placeholder for mobile features content */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={700} color="success">✓</Typography>
                <Typography variant="body2">Full analytics and data on mobile app</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={700} color="success">✓</Typography>
                <Typography variant="body2">Change cooperative settings and options</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={700} color="success">✓</Typography>
                <Typography variant="body2">Add and manage members directly from phone</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={700} color="success">✓</Typography>
                <Typography variant="body2">Get notifications straight from mobile app</Typography>
              </Box>
            </Box>
            <Button variant="contained" color="primary" sx={{ mt: 2 }}>Download App</Button>
          </Grid>
        </Grid>
      </Container>

      {/* Pricing Section */}
      <Box sx={{ bgcolor: 'grey.100', py: 8 }}>
        <Container>
          <Typography variant="h4" align="center" fontWeight={700} gutterBottom>
            No Hidden Charges! Choose Your Plan.
          </Typography>
          <Grid container spacing={4} justifyContent="center">
            {pricing.map((plan, index) => (
              <Grid item xs={12} sm={6} md={4} key={plan.name}>
                <Box sx={{ textAlign: 'center', py: 3, minHeight: 250, bgcolor: plan.highlight ? 'primary.light' : 'white', borderRadius: 2, boxShadow: plan.highlight ? 2 : 1 }}>
                  <Typography variant="h6" fontWeight={700} color={plan.highlight ? 'white' : 'text.primary'}>{plan.name}</Typography>
                  <Typography variant="h4" fontWeight={800} color={plan.highlight ? 'white' : 'text.primary'} my={2}>{plan.price}</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                    {plan.features.map((feature, fIndex) => (
                      <Box key={fIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={700} color={plan.highlight ? 'white' : 'success'}>✓</Typography>
                        <Typography variant="body2" color={plan.highlight ? 'white' : 'text.primary'}>{feature}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Button variant="contained" color="primary" component={RouterLink} to="/register" sx={{ color: plan.highlight ? 'white' : 'primary.main' }}>
                    Get Started
                  </Button>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* FAQ Section */}
      <Container sx={{ py: 8 }}>
        <Typography variant="h4" align="center" fontWeight={700} gutterBottom>
          Frequently Asked Questions
        </Typography>
        <Grid container spacing={2} justifyContent="center">
          {faqs.map((faq, index) => (
            <Grid item xs={12} md={8} key={index}>
              <Box sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: 1, p: 3 }}>
                <Typography variant="h6" fontWeight={700}>{faq.q}</Typography>
                <Typography variant="body1">{faq.a}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Testimonials Section */}
      <Container sx={{ py: 8 }}>
        <Typography variant="h4" align="center" fontWeight={700} gutterBottom>
          What Our Clients Say
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          {testimonials.map((testimonial, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Box sx={{ bgcolor: 'white', borderRadius: 2, boxShadow: 1, p: 3, minHeight: 180 }}>
                <Typography variant="body1" fontStyle="italic">"{testimonial.text}"</Typography>
                <Box mt={2}>
                  <Typography variant="subtitle1" fontWeight={700}>{testimonial.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{testimonial.org}</Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Call to Action Section */}
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 8, textAlign: 'center' }}>
        <Container>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Ready to Revolutionize Your Cooperative?
          </Typography>
          <Typography variant="h6" mb={4}>
            Start your free trial today. No credit card required.
          </Typography>
          <Button size="large" variant="contained" color="secondary" component={RouterLink} to="/register">
            Get Started
          </Button>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.900', color: 'grey.100', py: 4, mt: 8 }}>
        <Container>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="body2">&copy; {new Date().getFullYear()} E-Cooperative SaaS. All rights reserved.</Typography>
              <Typography variant="body2" mt={1}>Plot 24 Jerry Iriabe St, Lekki 1, Lagos</Typography>
              <Typography variant="body2" mt={1}>Privacy & Data Protection Policy.</Typography>
            </Grid>
            <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Box sx={{ display: 'inline-flex', gap: 2, mb: 1 }}>
                <IconButton component="a" href="https://facebook.com" target="_blank" rel="noopener" sx={{ color: 'grey.100', bgcolor: 'grey.800', '&:hover': { color: '#1877f3', bgcolor: 'grey.700' } }}><FacebookIcon fontSize="medium" /></IconButton>
                <IconButton component="a" href="https://twitter.com" target="_blank" rel="noopener" sx={{ color: 'grey.100', bgcolor: 'grey.800', '&:hover': { color: '#1da1f2', bgcolor: 'grey.700' } }}><TwitterIcon fontSize="medium" /></IconButton>
                <IconButton component="a" href="https://linkedin.com" target="_blank" rel="noopener" sx={{ color: 'grey.100', bgcolor: 'grey.800', '&:hover': { color: '#0a66c2', bgcolor: 'grey.700' } }}><LinkedInIcon fontSize="medium" /></IconButton>
                <IconButton component="a" href="https://instagram.com" target="_blank" rel="noopener" sx={{ color: 'grey.100', bgcolor: 'grey.800', '&:hover': { color: '#e1306c', bgcolor: 'grey.700' } }}><InstagramIcon fontSize="medium" /></IconButton>
              </Box>
              <Button color="inherit" component={RouterLink} to="/login" sx={{ mr: 2 }}>Login</Button>
              <Button color="inherit" component={RouterLink} to="/register">Sign Up</Button>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
};

export default LandingPage; 