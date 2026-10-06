// Source: Google Maps Platform Code Assist
import React, { useState, useEffect, useRef } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow,
  useMap 
} from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Navigation, 
  Search, 
  Layers, 
  Crosshair, 
  Maximize2, 
  Minimize2, 
  X, 
  Compass, 
  Radio, 
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface TacticalLocation {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  description: string;
  color: string;
}

const TACTICAL_LOCATIONS: TacticalLocation[] = [
  {
    id: 'loc-1',
    name: 'Búnker Principal VVC-ACIA',
    category: 'Comando Central',
    lat: 19.4326,
    lng: -99.1332,
    description: 'Nodo operativo primario con cifrado cuántico y satélite dedicado.',
    color: '#00f0ff',
  },
  {
    id: 'loc-2',
    name: 'Nodo Servidores Madrid',
    category: 'Infraestructura',
    lat: 40.4168,
    lng: -3.7038,
    description: 'Enrutador secundario europeo de baja latencia.',
    color: '#b026ff',
  },
  {
    id: 'loc-3',
    name: 'Obsidian Quantum Hub',
    category: 'I+D Cifrado',
    lat: 37.7749,
    lng: -122.4194,
    description: 'Laboratorio de modelos neuronales y hardware seguro.',
    color: '#00ff66',
  },
  {
    id: 'loc-4',
    name: 'Nodo Pacífico Tokyo',
    category: 'Vigilancia',
    lat: 35.6762,
    lng: 139.6503,
    description: 'Estación de monitoreo de señales y telemetría global.',
    color: '#ffaa00',
  },
];

interface GoogleMapsPanelProps {
  apiKey: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectCoordinates?: (coords: { lat: number; lng: number; label: string }) => void;
}

// Controller component to smoothly pan map when target changes
function MapCameraController({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !target) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    if (target.zoom) {
      map.setZoom(target.zoom);
    }
  }, [map, target]);

  return null;
}

export const GoogleMapsPanel: React.FC<GoogleMapsPanelProps> = ({
  apiKey,
  isOpen,
  onClose,
  onSelectCoordinates,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<TacticalLocation | null>(TACTICAL_LOCATIONS[0]);
  const [cameraTarget, setCameraTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>({
    lat: TACTICAL_LOCATIONS[0].lat,
    lng: TACTICAL_LOCATIONS[0].lng,
    zoom: 13,
  });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  if (!isOpen) return null;

  const handleQuickJump = (loc: TacticalLocation) => {
    setSelectedLocation(loc);
    setCameraTarget({ lat: loc.lat, lng: loc.lng, zoom: 14 });
    if (onSelectCoordinates) {
      onSelectCoordinates({ lat: loc.lat, lng: loc.lng, label: loc.name });
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocalización no soportada en este navegador');
      return;
    }
    setIsLocatingUser(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setCameraTarget({ lat: coords.lat, lng: coords.lng, zoom: 15 });
        setIsLocatingUser(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setIsLocatingUser(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Direct geocoding fetch via Geocoding API
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      searchQuery
    )}&key=${apiKey}`;

    fetch(geocodeUrl)
      .then((r) => r.json())
      .then((data) => {
        if (data.results && data.results.length > 0) {
          const loc = data.results[0].geometry.location;
          setCameraTarget({ lat: loc.lat, lng: loc.lng, zoom: 14 });
          const newLoc: TacticalLocation = {
            id: `search-${Date.now()}`,
            name: data.results[0].formatted_address || searchQuery,
            category: 'Búsqueda Global',
            lat: loc.lat,
            lng: loc.lng,
            description: `Ubicación localizada: ${data.results[0].formatted_address}`,
            color: '#00f0ff',
          };
          setSelectedLocation(newLoc);
        } else {
          alert('Ubicación no encontrada en Google Maps.');
        }
      })
      .catch((err) => {
        console.warn('Geocoding error:', err);
      });
  };

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isFullScreen
          ? 'inset-0 bg-black/90 p-2 md:p-4'
          : 'inset-x-2 bottom-4 md:inset-auto md:right-6 md:bottom-6 md:w-[680px] md:max-w-[95vw]'
      }`}
    >
      <div className="bg-[#080a0f] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.15)] flex flex-col overflow-hidden backdrop-blur-xl max-h-[92vh]">
        {/* Header HUD */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1117] border-b border-cyan-500/20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Compass className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold tracking-wider text-cyan-400 uppercase">
                  VVC-ACIA // Google Maps Radar
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
                  ONLINE
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono">
                Satélites conectados • API Oficial @vis.gl/react-google-maps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 text-gray-400 hover:text-cyan-400 rounded-lg hover:bg-cyan-950/40 transition-colors"
              title={isFullScreen ? 'Ventana reducida' : 'Pantalla completa'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-red-950/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Action Bar */}
        <div className="p-3 bg-[#06080c] border-b border-gray-800/60 flex flex-wrap gap-2 items-center">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar ciudad, dirección o coordenadas..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#0b0e14] border border-gray-700/60 rounded-xl text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-mono font-semibold bg-cyan-600/30 hover:bg-cyan-500/40 text-cyan-300 border border-cyan-500/40 rounded-xl transition-all"
            >
              Buscar
            </button>
          </form>

          <button
            onClick={handleLocateMe}
            disabled={isLocatingUser}
            className="px-2.5 py-1.5 text-xs font-mono flex items-center gap-1.5 bg-[#0e131b] hover:bg-cyan-950/50 text-cyan-400 border border-cyan-500/30 rounded-xl transition-colors disabled:opacity-50"
            title="Mi ubicación actual"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLocatingUser ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Mi Posición</span>
          </button>
        </div>

        {/* Tactical Nodes Strip */}
        <div className="px-3 py-2 bg-[#080b10] border-b border-gray-800/40 flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Radio className="w-3 h-3 text-cyan-400" /> Nodos:
          </span>
          {TACTICAL_LOCATIONS.map((loc) => {
            const isSelected = selectedLocation?.id === loc.id;
            return (
              <button
                key={loc.id}
                onClick={() => handleQuickJump(loc)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                    : 'bg-[#0f141d] text-gray-400 border-gray-800 hover:border-gray-700 hover:text-gray-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: loc.color }} />
                <span>{loc.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Map Container */}
        <div className="relative w-full h-[400px] md:h-[480px] bg-[#050608]">
          <APIProvider apiKey={apiKey} language="es">
            <Map
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              defaultCenter={{ lat: 19.4326, lng: -99.1332 }}
              defaultZoom={13}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              <MapCameraController target={cameraTarget} />

              {/* Render Preset Tactical Locations with AdvancedMarker */}
              {TACTICAL_LOCATIONS.map((loc) => (
                <AdvancedMarker
                  key={loc.id}
                  position={{ lat: loc.lat, lng: loc.lng }}
                  onClick={() => setSelectedLocation(loc)}
                  title={loc.name}
                >
                  <Pin
                    background={loc.color}
                    glyphColor="#000000"
                    borderColor="#ffffff"
                    scale={1.1}
                  />
                </AdvancedMarker>
              ))}

              {/* Render User GPS Location if active */}
              {userLocation && (
                <AdvancedMarker position={userLocation} title="Tu Ubicación Actual">
                  <div className="relative flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-white shadow-lg"></span>
                  </div>
                </AdvancedMarker>
              )}

              {/* InfoWindow for Selected Location */}
              {selectedLocation && (
                <InfoWindow
                  position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
                  onCloseClick={() => setSelectedLocation(null)}
                >
                  <div className="p-1 text-gray-900 max-w-xs font-sans">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-800">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{selectedLocation.name}</span>
                    </div>
                    <span className="inline-block px-1.5 py-0.5 mt-1 rounded text-[10px] font-mono bg-cyan-100 text-cyan-900 font-semibold">
                      {selectedLocation.category}
                    </span>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      {selectedLocation.description}
                    </p>
                    <div className="text-[10px] font-mono text-gray-500 mt-1.5 pt-1 border-t border-gray-200">
                      Lat: {selectedLocation.lat.toFixed(4)} | Lng: {selectedLocation.lng.toFixed(4)}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

          {/* Floating Coordinate Pill */}
          <div className="absolute bottom-3 left-3 z-10 px-2.5 py-1 bg-black/80 backdrop-blur-md border border-cyan-500/30 rounded-lg text-[10px] font-mono text-cyan-300 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>
              HUD MAPA • {selectedLocation ? selectedLocation.name : 'Modo Exploración'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
