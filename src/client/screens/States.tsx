import { navigateTo } from '@devvit/web/client';

export const LoadingScreen = () => (
  <div className="app" aria-busy="true" aria-label="Loading">
    <div className="skeleton" style={{ height: 22, width: '45%' }} />
    <div className="skeleton" style={{ height: 26, width: '85%' }} />
    <div className="hero">
      <div className="square skeleton" />
    </div>
    <div className="row">
      <div className="skeleton" style={{ height: 52 }} />
      <div className="skeleton" style={{ height: 52 }} />
    </div>
    <div className="row">
      <div className="skeleton" style={{ height: 52 }} />
      <div className="skeleton" style={{ height: 52 }} />
    </div>
  </div>
);

export const ErrorScreen = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="app center-col">
    <div className="hero">
      <div className="error-card panel">
        <p className="heading">Hmm, the blueprint got smudged.</p>
        <p className="subheading">{message}</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  </div>
);

export const ArchiveBanner = ({ subredditName, todayPostId }: { subredditName: string; todayPostId: string | null }) => (
  <button
    type="button"
    className="archive-banner"
    onClick={() =>
      navigateTo(
        todayPostId
          ? `https://www.reddit.com/r/${subredditName}/comments/${todayPostId.replace(/^t3_/, '')}/`
          : `https://www.reddit.com/r/${subredditName}/`
      )
    }
  >
    <span>📁 This is an old Blurprint</span>
    <span className="archive-link">today’s is here →</span>
  </button>
);
