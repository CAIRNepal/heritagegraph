'use client';

import Link from 'next/link';

export default function Services() {
  const services = [
    {
      name: 'Frontend Application',
      description: 'Main HeritageGraph application',
      url: 'http://localhost',
      color: 'from-blue-600 to-sky-500',
      icon: '🏛️',
    },
    {
      name: 'Backend API',
      description: 'Django REST API',
      url: 'http://backend.localhost',
      color: 'from-green-600 to-emerald-500',
      icon: '🔌',
    },
    {
      name: 'Keycloak Admin',
      description: 'Authentication & Identity Management',
      url: 'http://keycloak.localhost/admin',
      color: 'from-red-600 to-rose-500',
      icon: '🔐',
    },
    {
      name: 'Keycloak Realm',
      description: 'User realm console',
      url: 'http://keycloak.localhost',
      color: 'from-purple-600 to-pink-500',
      icon: '🌐',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100">
      <div className="max-w-6xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-blue-900 mb-4">
            HeritageGraph Services
          </h1>
          <p className="text-xl text-blue-700">
            Access all development services from one place
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {services.map((service) => (
            <a
              key={service.name}
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
            >
              {/* Gradient Background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
              />

              {/* Content */}
              <div className="relative p-8">
                <div className="text-6xl mb-4">{service.icon}</div>
                <h2 className="text-2xl font-bold text-blue-900 mb-2">
                  {service.name}
                </h2>
                <p className="text-blue-600 mb-6">{service.description}</p>
                <div className={`inline-flex items-center gap-2 text-sm font-semibold text-transparent bg-gradient-to-r ${service.color} bg-clip-text`}>
                  Open Service
                  <span className="text-lg">→</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Quick Info */}
        <div className="bg-white/80 backdrop-blur-sm border border-blue-200 rounded-2xl p-8">
          <h3 className="text-xl font-bold text-blue-900 mb-4">📋 Service Details</h3>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Frontend</h4>
              <p className="text-blue-700">Next.js application with Tailwind CSS</p>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-2 inline-block">
                localhost:3000
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Backend API</h4>
              <p className="text-blue-700">Django REST API</p>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-2 inline-block">
                backend.localhost:8000
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Keycloak</h4>
              <p className="text-blue-700">OAuth2 / OIDC Identity Provider</p>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-2 inline-block">
                keycloak.localhost:8080
              </code>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">Reverse Proxy</h4>
              <p className="text-blue-700">Traefik with static routing</p>
              <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-2 inline-block">
                Traefik v2.10
              </code>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-blue-700">
          <p>
            Developed by{' '}
            <a
              href="https://www.cair-nepal.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:text-blue-900"
            >
              CAIR-Nepal
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
