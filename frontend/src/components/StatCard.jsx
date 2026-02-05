import React from 'react'

export default function StatCard({
  title,
  value,
  icon,
  footerLeft,
  footerRight,
  gradient = true,
  loading = false,
  className = '',
  children,
}) {
  if (loading) {
    return (
      <div className={`stat-card animate-pulse ${className}`}>
        <div className="h-20 bg-gray-200 rounded" />
      </div>
    )
  }

  const containerClass = gradient ? 'bg-gradient-to-r from-perksu-purple to-perksu-blue text-white' : ''
  const titleClass = gradient ? 'text-white/80 text-sm' : 'text-sm text-gray-500'
  const valueClass = gradient ? 'text-3xl font-bold' : 'text-2xl font-bold text-gray-900'
  const footerWrapperClass =
    gradient ? 'mt-4 pt-4 border-t border-white/20 flex justify-between text-sm' : 'mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm'
  const footerTextClass = gradient ? 'text-white/80' : 'text-sm text-gray-500'

  return (
    <div className={`stat-card ${containerClass} ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={titleClass}>{title}</p>
          <p className={valueClass}>{value}</p>
        </div>
        {icon && (
          <div className={`${gradient ? 'w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center' : 'w-12 h-12 rounded-xl flex items-center justify-center'}`}>
            {icon}
          </div>
        )}
      </div>

      {children}

      {(footerLeft || footerRight) && (
        <div className={footerWrapperClass}>
          <span className={footerTextClass}>{footerLeft}</span>
          <span className={footerTextClass}>{footerRight}</span>
        </div>
      )}
    </div>
  )
}
