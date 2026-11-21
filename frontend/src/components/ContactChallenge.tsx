import { useEffect, useRef } from 'react';

interface Turnstile {
  render(element: HTMLElement, options: {
    sitekey: string;
    action: string;
    theme: 'auto';
    size: 'flexible';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'timeout-callback': () => void;
    'error-callback': () => void;
  }): string;
  remove(id: string): void;
}

declare global {
  interface Window { turnstile?: Turnstile }
}

let scriptRequest: Promise<Turnstile> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptRequest) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    scriptRequest = new Promise<Turnstile>((resolve, reject) => {
      const fail = () => {
        window.clearTimeout(timeout);
        script.remove();
        scriptRequest = undefined;
        reject(new Error('Could not load the security check'));
      };
      const timeout = window.setTimeout(fail, 10000);
      script.onload = () => {
        if (!window.turnstile) { fail(); return; }
        window.clearTimeout(timeout);
        resolve(window.turnstile);
      };
      script.onerror = fail;
      document.head.append(script);
    });
  }
  return scriptRequest;
}

interface Props {
  siteKey: string;
  action: 'contact' | 'demo';
  attempt: number;
  onToken: (token: string) => void;
  onFailure: (message: string) => void;
}

export default function ContactChallenge({ siteKey, action, attempt, onToken, onFailure }: Props) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    const fail = (message: string) => {
      if (active) { onToken(''); onFailure(message); }
    };
    onToken('');
    loadTurnstile().then(widget => {
      if (!active || !element.current) return;
      const id = widget.render(element.current, {
        sitekey: siteKey, action, theme: 'auto', size: 'flexible',
        callback: token => { if (active) { onToken(token); onFailure(''); } },
        'expired-callback': () => fail('The security check expired. Reload it to continue.'),
        'timeout-callback': () => fail('The security check timed out. Reload it to continue.'),
        'error-callback': () => fail('The security check failed. Reload it to try again.')
      });
      cleanup = () => widget.remove(id);
    }).catch(() => fail('The security check could not load. Reload it to try again.'));
    return () => { active = false; cleanup?.(); };
  }, [siteKey, action, attempt, onToken, onFailure]);

  return <div ref={element} />;
}
