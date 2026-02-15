import { Analytics } from '@vercel/analytics/react';
import Canvas from './Canvas';

function App() {
  return (
    <>
      <Canvas />
      <Analytics />
    </>
  );
}

export default App;
