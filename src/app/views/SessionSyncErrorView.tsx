import { SESSION_ERROR_CONTENT } from '../data/shellData.ts';

export function SessionSyncErrorView() {
  const handleRetryClick = () => {
    sessionStorage.clear();
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '500px', margin: 'auto' }}>
      <h2>{SESSION_ERROR_CONTENT.heading}</h2>
      <p>{SESSION_ERROR_CONTENT.description}</p>
      <p>
        <a href={SESSION_ERROR_CONTENT.retryHref} onClick={handleRetryClick}>
          {SESSION_ERROR_CONTENT.retryLabel}
        </a>
      </p>
    </div>
  );
}
