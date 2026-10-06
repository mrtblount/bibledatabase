import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import App from './App';
import './styles.css';

const deployment = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convex = new ConvexReactClient(deployment || 'http://127.0.0.1:3210');

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() {
    if (this.state.error) return <div className="fatal-error"><div className="brand-symbol">L</div><h1>Let’s reconnect.</h1><p>The workspace could not load. Check your Convex deployment and try again.</p><pre>{this.state.error}</pre><button className="primary-button" onClick={() => window.location.reload()}>Reload workspace</button></div>;
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><ErrorBoundary><ConvexProvider client={convex}><App configured={Boolean(deployment)} /></ConvexProvider></ErrorBoundary></React.StrictMode>,
);
