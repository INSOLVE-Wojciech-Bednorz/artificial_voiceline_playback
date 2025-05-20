import React from 'react';
import InfoTooltip from '../ui/InfoTooltip';

interface VoiceSettingsProps {
  settings: {
    id: string;
    model: string;
    stability: number;
    similarity: number;
    style: number;
    speed: number;
  };
  onChange: (field: string, value: any) => void;
}

const VoiceSettings: React.FC<VoiceSettingsProps> = ({ settings, onChange }) => {
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Parse numeric values
    let parsedValue: string | number = value;
    if (name !== 'id' && name !== 'model') {
      parsedValue = parseFloat(value);
    }
    
    onChange(name, parsedValue);
  };

  return (
    <>
      <label className="inline-block text-sm font-medium mb-2 flex items-center">
        Voice Settings
        <span className="ml-2">
          <InfoTooltip 
            content="Ustawienia głosu pozwalają na dostosowanie parametrów syntezatora mowy ElevenLabs, co wpływa na jakość i charakterystykę generowanych linii głosowych." 
          />
        </span>
      </label>
      <div className="space-y-4">
        {/* Voice ID and Model */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="voice_id" className="block text-xs font-medium text-gray-700">
                Voice ID
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Unikalny identyfikator głosu w systemie ElevenLabs. Każdy głos ma przypisany własny identyfikator, który można znaleźć w panelu ElevenLabs." 
                  position="right"
                />
              </span>
            </div>
            <input
              type="text"
              id="voice_id"
              name="id"
              value={settings.id}
              onChange={handleInputChange}
              className="mt-1 py-1.5 sm:py-2 px-3 block w-full border-gray-200 shadow-2xs sm:text-sm rounded-lg focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="voice_model" className="block text-xs font-medium text-gray-700">
                Voice Model
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Model głosowy używany przez ElevenLabs. Dostępne modele to np. 'eleven_monolingual_v1', 'eleven_multilingual_v1' itp. Nowsze modele oferują lepszą jakość kosztem wydajności." 
                  position="right"
                />
              </span>
            </div>
            <input
              type="text"
              id="voice_model"
              name="model"
              value={settings.model}
              onChange={handleInputChange}
              className="mt-1 py-1.5 sm:py-2 px-3 block w-full border-gray-200 shadow-2xs sm:text-sm rounded-lg focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stability Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="stability" className="block text-xs font-medium text-gray-700">
                Stability: {settings.stability.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Stabilność głosu - wyższe wartości dają bardziej spójny i jednolity głos, niższe wartości dodają więcej różnorodności i ekspresji. Zalecana wartość: 0.5-0.75" 
                  position="right"
                />
              </span>
            </div>
            <input
              type="range"
              id="stability"
              name="stability"
              min="0"
              max="1"
              step="0.01"
              value={settings.stability}
              onChange={handleInputChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Similarity Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="similarity" className="block text-xs font-medium text-gray-700">
                Similarity: {settings.similarity.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Podobieństwo do oryginalnego głosu - wyższe wartości dają większe podobieństwo do oryginalnej próbki głosowej. Zalecana wartość: 0.75 lub wyższa." 
                  position="right"
                />
              </span>
            </div>
            <input
              type="range"
              id="similarity"
              name="similarity"
              min="0"
              max="1"
              step="0.01"
              value={settings.similarity}
              onChange={handleInputChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Style Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="style" className="block text-xs font-medium text-gray-700">
                Style: {settings.style.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Transfer stylu głosowego - wyższe wartości wzmacniają styl głosu i mogą dodać więcej ekspresji, niższe wartości tworzą bardziej neutralny ton. Dostępne dla nowszych modeli." 
                  position="right"
                />
              </span>
            </div>
            <input
              type="range"
              id="style"
              name="style"
              min="0"
              max="1"
              step="0.01"
              value={settings.style}
              onChange={handleInputChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0</span>
              <span>1</span>
            </div>
          </div>

          {/* Speed Slider */}
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="speed" className="block text-xs font-medium text-gray-700">
                Speed: {settings.speed.toFixed(2)}
              </label>
              <span className="ml-2">
                <InfoTooltip 
                  content="Prędkość mówienia - wartości powyżej 1.0 przyspieszają mowę, wartości poniżej 1.0 ją spowalniają. Normalna prędkość to 1.0." 
                  position="right"
                />
              </span>
            </div>
            <input
              type="range"
              id="speed"
              name="speed"
              min="0.5"
              max="2"
              step="0.01"
              value={settings.speed}
              onChange={handleInputChange}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0.5</span>
              <span>2</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default VoiceSettings;