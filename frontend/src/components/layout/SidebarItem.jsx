import { NavLink } from 'react-router-dom';

const SidebarItem = ({ icon: Icon, label, path, badge = null }) => {
  return (
    <NavLink
      to={path}
      end
      className={({ isActive }) =>
        `group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out
        ${isActive 
          ? 'bg-gradient-to-r from-red-600/20 to-red-500/10 text-red-400 border-l-4 border-red-500' 
          : 'text-gray-400 hover:text-white hover:bg-white/5 hover:translate-x-1'
        }`
      }
    >
      <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
      <span className="font-medium text-sm">{label}</span>
      {badge && (
        <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-red-500/20 text-red-400 rounded-full">
          {badge}
        </span>
      )}
    </NavLink>
  );
};

export default SidebarItem;