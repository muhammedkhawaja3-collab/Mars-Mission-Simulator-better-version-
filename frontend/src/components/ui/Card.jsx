import './Card.css';

/**
 * Surface container. `accent` (a data colour) only tints the top border.
 * @param {{as?: string, accent?: string, className?: string}} props
 */
export default function Card({ as: Tag = 'section', accent, className = '', children, ...rest }) {
  return (
    <Tag
      className={['card', className].filter(Boolean).join(' ')}
      style={accent ? { '--card-accent': accent } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
