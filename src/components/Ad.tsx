import React from 'react';
import { Link } from 'react-router-dom';

const Ad: React.FC = () => {
  return (
    <div className="my-8">
      <Link to="/starlink-checkout">
        <img 
          src="/starlinkanuncio.jpg" 
          alt="Anúncio Starlink" 
          className="w-full rounded-lg shadow-md hover:opacity-90 transition-opacity cursor-pointer"
        />
      </Link>
    </div>
  );
};

export default Ad;