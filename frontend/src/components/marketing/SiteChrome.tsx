import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MenuRounded from '@mui/icons-material/MenuRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import Brand from '../Brand';
import { brand } from '../../brand';
import './marketing.css';

const platform = [['Features', '/#features'], ['Solutions', '/#solutions'], ['How It Works', '/#how-it-works']] as const;
const company = [['Pricing', '/pricing'], ['About', '/about'], ['Contact', '/contact']] as const;

function NavigationLinks({ onClick }: { onClick?: () => void }) {
  return <>
    {platform.map(([label, href]) => <a key={href} href={href} onClick={onClick}>{label}</a>)}
    {company.map(([label, to]) => <Link key={to} to={to} onClick={onClick}>{label}</Link>)}
  </>;
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="cs-header">
    <div className="cs-container cs-header-inner">
      <Brand inverse={false} onNavigate={() => setOpen(false)} />
      <nav className="cs-desktop-nav" aria-label="Main navigation"><NavigationLinks /></nav>
      <div className="cs-header-actions">
        <Link className="cs-sign-in" to="/login">Log in</Link>
        <Link className="cs-button cs-button-primary" to="/register">Get Started <ArrowForwardRounded /></Link>
      </div>
      <button type="button" className="cs-menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open} aria-controls="cs-mobile-menu" onClick={() => setOpen(!open)}>
        {open ? <CloseRounded /> : <MenuRounded />}
      </button>
    </div>
    <nav className="cs-mobile-nav cs-container" id="cs-mobile-menu" aria-label="Mobile navigation"
      hidden={!open} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); document.querySelector<HTMLButtonElement>('.cs-menu-toggle')?.focus(); } }}>
      <NavigationLinks onClick={() => setOpen(false)} />
      <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>
      <Link className="cs-button cs-button-primary" to="/register" onClick={() => setOpen(false)}>Get Started <ArrowForwardRounded /></Link>
    </nav>
  </header>;
}

export function SiteFooter() {
  return <footer className="cs-footer">
    <div className="cs-container">
      <div className="cs-footer-grid">
        <div className="cs-footer-brand"><Brand inverse /><p>{brand.tagline}</p><small>A proprietary software product owned and developed by {brand.owner}.</small></div>
        <div><h2>Product</h2><a href="/#features">Features</a><a href="/#solutions">Solutions</a><Link to="/faq">FAQ</Link></div>
        <div><h2>Company</h2><Link to="/about">About</Link><Link to="/contact">Contact</Link><Link to="/login">Log in</Link><Link to="/register">Get Started</Link></div>
        <div><h2>Legal</h2><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms and Conditions</Link><Link to="/intellectual-property">Intellectual Property</Link><Link to="/acceptable-use">Acceptable Use</Link></div>
      </div>
      <div className="cs-footer-bottom">{brand.copyright}</div>
    </div>
  </footer>;
}
