from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

class LocationAgent:
    def __init__(self):
        # User agent is required by Nominatim policy
        self.geolocator = Nominatim(user_agent="arogya_ai_hackathon_demo")

    def get_coordinates(self, location_name):
        """Converts text address to Lat/Lon."""
        try:
            location = self.geolocator.geocode(location_name, timeout=10)
            if location:
                return {"lat": location.latitude, "lon": location.longitude}
            return None
        except GeocoderTimedOut:
            return None

    def search_nearby_hospitals(self, lat, lon):
        """
        Simulates finding hospitals near the coordinates.
        (For a Hackathon, real-time Google Places API is complex/paid. 
        This simulation guarantees the demo works perfectly.)
        """
        # We generate simulated hospitals slightly offset from the user's location
        # so they appear nearby on the map.
        
        hospitals = [
            {
                "name": "City General Hospital",
                "lat": lat + 0.002, 
                "lon": lon + 0.002,
                "address": "Main Road, Near Chowk"
            },
            {
                "name": "LifeCare Emergency Clinic",
                "lat": lat - 0.002, 
                "lon": lon - 0.001,
                "address": "Sector 4, Green Park"
            },
            {
                "name": "Arogya Kendra (Govt)",
                "lat": lat + 0.001, 
                "lon": lon - 0.003,
                "address": "Station Road"
            }
        ]
        return hospitals