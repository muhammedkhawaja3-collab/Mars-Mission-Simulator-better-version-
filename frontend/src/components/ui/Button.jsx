import './Button.css';

/**
 * Button. Always a native <button>; defaults to type="button".
 * @param {{variant?: 'primary'|'secondary'|'ghost'|'danger', size?: 'md'|'lg'|'sm', block?: boolean}} props
 */
export default function Button({
  variant = 'secondary',
  size = 'md',
  block = false,
  className = '',
  type = 'button',
  ...rest
}) {
  const cls = ['btn', `btn--${variant}`, `btn--${size}`, block && 'btn--block', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}
