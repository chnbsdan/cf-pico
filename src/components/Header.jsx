import React from 'react'

export default function Header() {
  return (
    <div className="text-center mb-4 animate-fade-in">
      <div className="flex items-center justify-center gap-2 mb-1">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
          <i className="fas fa-cloud-upload-alt text-xl text-white"></i>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg">
          Hangdn ImgBed
        </h1>
      </div>
      <p className="text-white/60 text-xs">
        基于 GitHub 私有仓库的独立图床
      </p>
    </div>
  )
}
