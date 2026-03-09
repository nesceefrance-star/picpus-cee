import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PICPUSHub from './Hub.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PICPUSHub />
  </StrictMode>
)
