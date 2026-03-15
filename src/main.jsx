import React from 'react'
import ReactDOM from 'react-dom/client'
import Forge3D from './Forge3D.jsx'
import { requireForgeAPI } from './forge3d/forge-api.js'

requireForgeAPI()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Forge3D />
  </React.StrictMode>
)
