import React from 'react';
import ReactDOM from 'react-dom/client';
import '@primer/primitives/dist/css/primitives.css';
import '@primer/primitives/dist/css/functional/themes/light.css';
import '@primer/primitives/dist/css/functional/themes/dark.css';
import '@primer/primitives/dist/css/functional/themes/dark-dimmed.css';
import './index.css';
import './Components/global-adaptive.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { UserProvider } from './Components/Utils/UserContext';
import { ColorModeProvider } from './Components/Utils/ThemeContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
    <BrowserRouter>
        <ColorModeProvider>
            <UserProvider>
                <App/>
            </UserProvider>
        </ColorModeProvider>
    </BrowserRouter>
);

reportWebVitals();
