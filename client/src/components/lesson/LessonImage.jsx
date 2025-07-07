// e:\Spacey-Intern\spacey_first_demo\spacey_demo_2\client\src\components\lesson\LessonImage.jsx

import React from 'react';

const LessonImage = ({ src, alt }) => {
  // Don't render anything if no image source is provided
  if (!src) {
    return null;
  }

  return (
    <div className="mb-8 animate-fade-in">
      <img
        src={src}
        alt={alt}
        className="w-full h-80 object-contain rounded-lg border border-white/10 shadow-lg shadow-cyan-500/10"
      />
    </div>
  );
};

export default LessonImage;
