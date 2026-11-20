export const brand = {
  name: 'Co-opSphere',
  tagline: 'Cooperative Management, Simplified.',
  owner: 'Mega Stride Technologies Limited',
  ownership: 'Owned and Developed by Mega Stride Technologies Limited.',
  attribution: 'A Mega Stride Technologies Limited Product.',
  copyright: `© ${new Date().getFullYear()} Mega Stride Technologies Limited. All Rights Reserved.`,
  title: 'Co-opSphere | Cooperative Management, Simplified.',
  description: 'Co-opSphere is a comprehensive cooperative management platform for managing members, savings, contributions, loans, accounting, payments, and financial operations. Owned and developed by Mega Stride Technologies Limited.',
  logo: { light: '/brand/wordmark-light.png', dark: '/brand/wordmark-dark.png', icon: '/brand/icon-192.png' },
  favicon: '/brand/favicon.png',
  socialImage: '/brand/social-card.png',
  colors: {
    navy: '#0B1530', midnight: '#101D3A', royal: '#2563EB', electric: '#3B82F6',
    teal: '#14B8A6', mint: '#D1FAE5', gold: '#F5B942', white: '#FFFFFF',
    light: '#F5F8FF', gray: '#E9EEF5'
  }
} as const;
