import { NavLink } from 'react-router-dom';

const SidebarItem = ({ icon: Icon, label, path, badge = null, isDanger = false, onClick }) => {
  const baseClass =
    'group flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-300 ease-out';

  const defaultClass = isDanger
    ? 'border-transparent text-rose-300/90 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-200'
    : 'border-transparent text-gray-300 hover:border-white/10 hover:bg-white/5 hover:text-white';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${baseClass} ${defaultClass}`}>
        <Icon className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
        <span className="truncate text-sm font-medium tracking-wide">{label}</span>
        {badge ? (
          <span className="ml-auto rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
            {badge}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <NavLink
      to={path}
      end
      className={({ isActive }) =>
        `${baseClass} ${
          isActive
            ? 'border-red-500/40 bg-gradient-to-r from-red-900/40 via-red-800/25 to-transparent text-red-200 shadow-lg shadow-red-900/20'
            : defaultClass
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0 transition-transform duration-300 group-hover:scale-110" />
      <span className="truncate text-sm font-medium tracking-wide">{label}</span>
      {badge && (
        <span className="ml-auto rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
          {badge}
        </span>
      )}
    </NavLink>
  );
};

export default SidebarItem;