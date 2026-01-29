import { Link } from 'react-router-dom';
import './Breadcrumb.css';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Accessible breadcrumb navigation component.
 * Follows WAI-ARIA Authoring Practices for breadcrumbs.
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb" data-testid="breadcrumb-nav">
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="breadcrumb-item">
              {!isLast && item.href ? (
                <>
                  <Link
                    to={item.href}
                    className="breadcrumb-link"
                    data-testid={`breadcrumb-link-${index}`}
                  >
                    {item.label}
                  </Link>
                  <span className="breadcrumb-separator" aria-hidden="true">
                    /
                  </span>
                </>
              ) : (
                <span
                  className="breadcrumb-current"
                  aria-current="page"
                  data-testid="breadcrumb-current"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
