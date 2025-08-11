# Advanced Weather App

A modern, full-stack weather application built with Next.js 15, featuring real-time weather data, advanced search capabilities, and persistent data storage with CRUD operations.

## Features

### Core Weather Functionality
- **Real-time weather data** from OpenWeatherMap API
- **Current conditions** with temperature, feels-like, humidity, and wind speed
- **5-day weather forecast** with daily high/low temperatures
- **Multiple location input methods**:
  - ZIP code lookup (US)
  - Geolocation (current position)
  - City/state/country search
  - Latitude/longitude coordinates

### Advanced Search & Data Management
- **Advanced search interface** with flexible location and date range inputs
- **CRUD operations** for weather queries:
  - Create and save weather queries
  - Read/view saved queries with detailed results
  - Update existing queries (location, date range, notes)
  - Delete unwanted queries
- **Persistent storage** using Supabase database
- **Query management** with organized listing and filtering
- **Date range extension/reduction** for saved queries

### Data Processing
- **Daily weather aggregation** from 3-hour forecast intervals
- **Local timezone handling** for accurate date calculations
- **Statistical summaries** (min/max/average temperatures)
- **Smart midday representative selection** for daily icons and descriptions

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Frontend**: React 19, Tailwind CSS 4
- **Database**: Supabase (PostgreSQL)
- **API**: OpenWeatherMap API
- **Deployment**: Vercel-ready

## Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm/bun
- OpenWeatherMap API key
- Supabase account and project

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd weatherapp
npm install
```

### 2. Environment Configuration

Create `.env.local` file:

```env
OPENWEATHER_API_KEY=your_openweathermap_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Database Setup

Run the SQL schema in your Supabase project:

```sql
create table weather_queries (
  id uuid default gen_random_uuid() primary key,
  location_input jsonb not null,
  normalized_location jsonb,
  start_date date not null,
  end_date date not null,
  units text default 'imperial',
  source text default 'openweathermap',
  result jsonb,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 4. API Keys

#### OpenWeatherMap API
1. Sign up at [OpenWeatherMap](https://openweathermap.org/api)
2. Get your free API key
3. Add to `.env.local`

#### Supabase Setup
1. Create project at [Supabase](https://supabase.com)
2. Get your project URL and keys from Settings > API
3. Add to `.env.local`

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## API Endpoints

### Weather API
- `GET /api/weather?zip={zipcode}` - Get weather by ZIP code
- `GET /api/weather?lat={lat}&lon={lon}` - Get weather by coordinates

### Location API
- `GET /api/location?lat={lat}&lon={lon}` - Reverse geocoding

### Weather Queries CRUD
- `GET /api/queries` - List all saved queries
- `POST /api/queries` - Create new weather query
- `GET /api/queries/{id}` - Get specific query
- `PATCH /api/queries/{id}` - Update existing query
- `DELETE /api/queries/{id}` - Delete query

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── weather/route.js         # Core weather API
│   │   ├── location/route.js        # Geolocation API  
│   │   └── queries/
│   │       ├── route.js             # CRUD operations
│   │       └── [id]/route.js        # Single query operations
│   ├── saved/
│   │   ├── page.jsx                 # Saved queries list
│   │   └── [id]/page.jsx           # Query detail view
│   ├── layout.js                    # Root layout
│   ├── page.jsx                     # Main weather page
│   └── globals.css                  # Global styles
├── components/
│   └── dayRange.jsx                 # Date range controls
└── lib/
    └── supabaseAdmin.js             # Supabase client
```

## Key Features Explained

### Weather Data Processing
The app uses a sophisticated algorithm to convert OpenWeatherMap's 3-hour forecast intervals into daily aggregates:

1. **Timezone Conversion**: Adjusts UTC timestamps to local time using OpenWeatherMap's timezone offset
2. **Date Grouping**: Groups forecast points by local calendar date
3. **Daily Aggregation**: Calculates high/low temperatures and averages for each day
4. **Representative Selection**: Chooses the forecast point closest to 12:00 PM local time for daily weather icons and descriptions

### Advanced Search
The advanced search feature allows users to:
- Select location input method (ZIP, coordinates, or place name)
- Choose custom date ranges within the 5-day forecast window
- Add notes for query organization
- Save queries for future reference and modification

### CRUD Operations
Full Create, Read, Update, Delete functionality for weather queries:
- **Create**: Save new weather searches with all parameters
- **Read**: View saved queries with full weather data and summaries
- **Update**: Modify location, date range, or notes while preserving weather data
- **Delete**: Remove unwanted queries

## Deployment

### Vercel (Recommended)

```bash
npm run build
```

Deploy to Vercel by connecting your GitHub repository or using the Vercel CLI.

### Environment Variables
Ensure all environment variables are configured in your deployment platform:
- `OPENWEATHER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

For issues and questions:
1. Check the [Issues](../../issues) page
2. Review the [API documentation](https://openweathermap.org/api)
3. Check [Supabase documentation](https://supabase.com/docs)

---

Built with ❤️ using Next.js, Supabase, and OpenWeatherMap API.
