 /* components/access/ContentAccessGuard.jsx */
import { useContentAccess } from '../../hooks/useContentAccess';
import { PendingApprovalScreen } from './PendingApprovalScreen';
import { AccessDenied } from './AccessDenied';

export function ContentAccessGuard({ children, fallback, requiredLevel }) {
  const access = useContentAccess();

  if (!access.canAccess) {
    if (access.isPending) {
      return <PendingApprovalScreen />;
    }
    return fallback || <AccessDenied />;
  }

  if (requiredLevel && !access.showAll && access.level !== requiredLevel) {
    return fallback || <AccessDenied />;
  }

  return children;
}
