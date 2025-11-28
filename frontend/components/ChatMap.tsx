// frontend/components/ChatMap.tsx - UPDATED FIX

import React from 'react';
// We use dynamic imports for react-leaflet to ensure it only runs on the client-side
import dynamic from 'next/dynamic';

// Define the shape of the data coming from your Python API
interface MapData {
  center: { lat: number; lon: number };
  markers: Array<{ name: string; lat: number; lon: number; address: string }>;
}

interface ChatMapProps {
  mapData: MapData;
}

// 1. Create a component that does all the Leaflet setup (Marker logic)
//    and uses the dynamically imported MapContainer.
const MapWrapper: React.FC<ChatMapProps> = ({ mapData }) => {
  // We use require inside a function/component to ensure it runs only when the component is mounted (client-side)
  const L = require('leaflet');
  const { MapContainer, TileLayer, Marker, Popup } = require('react-leaflet');

  // Fix for leaflet markers not showing up in Next.js
  const DefaultIcon = L.icon({
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
  L.Marker.prototype.options.icon = DefaultIcon;

  const position: [number, number] = [mapData.center.lat, mapData.center.lon];

  return (
    <div className="h-96 w-full rounded-lg shadow-xl mt-4">
      <MapContainer 
        center={position} 
        zoom={13} 
        scrollWheelZoom={false} 
        className="h-full w-full rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Marker for the user's general location (center) */}
        <Marker position={position}>
          <Popup>You are here (Approximate)</Popup>
        </Marker>

        {/* Markers for nearby hospitals/clinics */}
        {mapData.markers.map((marker, index) => (
          <Marker key={index} position={[marker.lat, marker.lon]}>
            <Popup>
              <h3 className="font-bold">{marker.name}</h3>
              <p>{marker.address}</p>
              <p className="text-xs text-gray-500">Suggested Clinic</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

// 2. Export the component wrapped in next/dynamic
const ChatMap = dynamic(() => Promise.resolve(MapWrapper), { ssr: false });

export default ChatMap;