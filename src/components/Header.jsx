import React from 'react'

export default function Header() {
  return (
    <div className="text-center mb-8 animate-fade-in">
      <div className="flex items-center justify-center gap-3 mb-3">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg">
          <i className="fas fa-cloud-upload-alt text-3xl text-white"></i>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
          ImgBed
        </h1>
      </div>
      <p className="text-white/80 text-sm md:text-base">
        基于 GitHub 私有仓库的独立图床
      </p>
    </div>
  )
}
