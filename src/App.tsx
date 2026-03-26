/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, RotateCcw, AlertCircle, Settings, X, Save, Download, Loader2 } from 'lucide-react';

// Default flower definitions
const DEFAULT_FLOWERS = [
  {
    id: 'flower1',
    name: 'Bloem 1',
    url: '/input_file_2.png',
    source: '',
    color: 'bg-white',
    textColor: 'text-stone-600'
  },
  {
    id: 'flower2',
    name: 'Bloem 2',
    url: '/input_file_1.png',
    source: '',
    color: 'bg-purple-100',
    textColor: 'text-purple-700'
  },
  {
    id: 'flower3',
    name: 'Bloem 3',
    url: '/input_file_0.png',
    source: '',
    color: 'bg-yellow-100',
    textColor: 'text-yellow-700'
  },
  {
    id: 'flower4',
    name: 'Bloem 4',
    url: 'https://picsum.photos/seed/flower4/200',
    source: '',
    color: 'bg-pink-100',
    textColor: 'text-pink-700'
  },
  {
    id: 'flower5',
    name: 'Bloem 5',
    url: 'https://picsum.photos/seed/flower5/200',
    source: '',
    color: 'bg-orange-100',
    textColor: 'text-orange-700'
  },
];

// Helper component for flower images with fallback
const FlowerImage = ({ flower, className = "" }: { flower: any, className?: string }) => {
  const [error, setError] = React.useState(false);

  if (!flower) return null;

  return (
    <div className={`relative w-full h-full flex items-center justify-center ${className}`}>
      {!error ? (
        <img
          src={flower.url}
          alt={flower.name}
          className="w-full h-full object-cover p-1"
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center p-2 text-center text-[10px] font-bold leading-tight rounded-lg ${flower.color} ${flower.textColor || 'text-stone-800'}`}>
          {flower.name}
        </div>
      )}
    </div>
  );
};

// Helper to generate a random NxN Latin Square puzzle
const generatePuzzle = (flowers: any[], preFilledCount: number, size: number) => {
  const flowerIds = flowers.slice(0, size).map(f => f.id);
  // Shuffle flowerIds
  const shuffled = [...flowerIds].sort(() => Math.random() - 0.5);
  
  // Create solution (Latin Square)
  // A simple way to generate a Latin Square is to shift a base row
  const solution: string[][] = [];
  const shift = Math.floor(Math.random() * (size - 1)) + 1; // Random shift amount
  
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push(shuffled[(r * shift + c) % size]);
    }
    solution.push(row);
  }

  // Create initial grid by keeping specified number of random cells
  const initialGrid = Array(size).fill(null).map(() => Array(size).fill(null));
  const positions = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      positions.push([r, c]);
    }
  }
  
  // Shuffle positions and take preFilledCount
  const startingPositions = positions.sort(() => Math.random() - 0.5).slice(0, Math.min(preFilledCount, size * size));
  startingPositions.forEach(([r, c]) => {
    initialGrid[r][c] = solution[r][c];
  });

  return { solution, initialGrid };
};

interface Flower {
  id: string;
  name: string;
  url: string;
  source: string;
  color: string;
  textColor: string;
}

interface SavedConfig {
  id: number;
  name: string;
  date: string;
  flowers: Flower[];
  gridSize: number;
  preFilledCount: number;
  initialGridState: (string | null)[][];
  solution: string[][];
}

export default function App() {
  const [flowers, setFlowers] = useState<Flower[]>(DEFAULT_FLOWERS);
  const [gridSize, setGridSize] = useState(3);
  const [preFilledCount, setPreFilledCount] = useState(3);
  const [showSettings, setShowSettings] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  
  const [grid, setGrid] = useState<(string | null)[][]>(Array(3).fill(null).map(() => Array(3).fill(null)));
  const [solution, setSolution] = useState<string[][]>([]);
  const [initialGridState, setInitialGridState] = useState<(string | null)[][]>(Array(3).fill(null).map(() => Array(3).fill(null)));
  const [status, setStatus] = useState<'playing' | 'correct' | 'incorrect'>('playing');
  const [errors, setErrors] = useState<boolean[][]>(Array(3).fill(null).map(() => Array(3).fill(false)));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Temporary settings state
  const [tempFlowers, setTempFlowers] = useState<Flower[]>(DEFAULT_FLOWERS);
  const [tempPreFilled, setTempPreFilled] = useState(3);
  const [tempGridSize, setTempGridSize] = useState(3);

  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [configName, setConfigName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const startNewGame = (currentFlowers = flowers, currentCount = preFilledCount, size = gridSize) => {
    const { solution: newSolution, initialGrid: newInitial } = generatePuzzle(currentFlowers, currentCount, size);
    setSolution(newSolution);
    setInitialGridState(newInitial);
    setGrid(newInitial);
    setStatus('playing');
    setErrors(Array(size).fill(null).map(() => Array(size).fill(false)));
  };

  useEffect(() => {
    if (showSettings && isAdmin) {
      loadSavedConfigs();
    }
  }, [showSettings, isAdmin]);

  const loadSavedConfigs = async () => {
    try {
      const response = await fetch('/api/load-configs');
      if (response.ok) {
        const data = await response.json();
        setSavedConfigs(data);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    }
  };

  const saveCurrentConfig = async () => {
    if (!configName.trim()) {
      alert('Voer een naam in voor deze versie.');
      return;
    }
    setIsSaving(true);
    try {
      const configToSave = {
        name: configName,
        flowers,
        gridSize,
        preFilledCount,
        initialGridState,
        solution
      };
      const response = await fetch('/api/save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave)
      });
      if (response.ok) {
        setConfigName('');
        loadSavedConfigs();
        alert('Versie succesvol opgeslagen!');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Fout bij het opslaan.');
    } finally {
      setIsSaving(false);
    }
  };

  const loadConfig = (config: SavedConfig) => {
    setFlowers(config.flowers);
    setGridSize(config.gridSize || 3);
    setPreFilledCount(config.preFilledCount);
    setInitialGridState(config.initialGridState);
    setSolution(config.solution);
    setGrid(config.initialGridState);
    setStatus('playing');
    setErrors(Array(config.gridSize || 3).fill(null).map(() => Array(config.gridSize || 3).fill(false)));
    setShowSettings(false);
  };

  const deleteConfig = async (id: number) => {
    if (!confirm('Weet je zeker dat je deze versie wilt verwijderen?')) return;
    try {
      const response = await fetch(`/api/delete-config/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        loadSavedConfigs();
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      alert('Fout bij het verwijderen.');
    }
  };

  // Initialize game and check URL params
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
    
    const params = new URLSearchParams(window.location.search);
    
    // Check if user is admin
    if (params.get('admin') === 'true') {
      setIsAdmin(true);
    }

    // Load settings from URL if present
    const f1 = params.get('f1');
    const f2 = params.get('f2');
    const f3 = params.get('f3');
    const f4 = params.get('f4');
    const f5 = params.get('f5');
    const n = params.get('n');
    const s = params.get('s');

    let initialFlowers = [...DEFAULT_FLOWERS];
    if (f1) initialFlowers[0] = { ...initialFlowers[0], url: f1 };
    if (f2) initialFlowers[1] = { ...initialFlowers[1], url: f2 };
    if (f3) initialFlowers[2] = { ...initialFlowers[2], url: f3 };
    if (f4) initialFlowers[3] = { ...initialFlowers[3], url: f4 };
    if (f5) initialFlowers[4] = { ...initialFlowers[4], url: f5 };
    
    const initialCount = n ? parseInt(n) : 3;
    const initialSize = s ? parseInt(s) : 3;

    setFlowers(initialFlowers);
    setGridSize(initialSize);
    setPreFilledCount(initialCount);
    setTempFlowers(initialFlowers);
    setTempPreFilled(initialCount);
    setTempGridSize(initialSize);
    
    startNewGame(initialFlowers, initialCount, initialSize);
  }, []);

  const saveSettings = () => {
    setFlowers(tempFlowers);
    setPreFilledCount(tempPreFilled);
    setShowSettings(false);
    startNewGame(tempFlowers, tempPreFilled);
  };

  const copyShareLink = () => {
    let baseUrl = window.location.origin + window.location.pathname;
    
    // Auto-replace dev URL with pre (public) URL for easier sharing
    if (baseUrl.includes('ais-dev-')) {
      baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
    }

    const params = new URLSearchParams();
    params.set('f1', tempFlowers[0].url);
    params.set('f2', tempFlowers[1].url);
    params.set('f3', tempFlowers[2].url);
    params.set('f4', tempFlowers[3].url);
    params.set('f5', tempFlowers[4].url);
    params.set('n', tempPreFilled.toString());
    params.set('s', tempGridSize.toString());
    
    const shareUrl = `${baseUrl}?${params.toString()}`;
    navigator.clipboard.writeText(shareUrl);
    alert('Publieke deel-link gekopieerd! Deze link werkt voor iedereen op WAI-NOT (zonder inloggen).');
  };

  const handleFileUpload = async (idx: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.url) {
        const newTemp = [...tempFlowers];
        newTemp[idx] = { ...newTemp[idx], url: data.url };
        setTempFlowers(newTemp);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload mislukt. Probeer het opnieuw.');
    }
  };

  const handleUrlUpload = async (idx: number, url: string) => {
    if (!url || !url.startsWith('http')) {
      alert('Voer een geldige URL in die begint met http of https.');
      return;
    }
    setDownloadingIdx(idx);
    try {
      const response = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (data.url) {
        const newTemp = [...tempFlowers];
        newTemp[idx] = { ...newTemp[idx], url: data.url };
        setTempFlowers(newTemp);
      } else if (data.error) {
        alert(`Fout: ${data.error}`);
      }
    } catch (err) {
      console.error('URL upload failed:', err);
      alert('Het downloaden van de afbeelding is mislukt. Controleer de URL.');
    } finally {
      setDownloadingIdx(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, flowerId: string, sourceRow?: number, sourceCol?: number) => {
    e.dataTransfer.setData('flowerId', flowerId);
    if (sourceRow !== undefined && sourceCol !== undefined) {
      e.dataTransfer.setData('sourceRow', sourceRow.toString());
      e.dataTransfer.setData('sourceCol', sourceCol.toString());
    }
    e.dataTransfer.effectAllowed = 'move';
    
    // Ensure the drag image is the flower image itself
    const img = (e.currentTarget as HTMLElement).querySelector('img');
    if (img) {
      // Set the drag image to the img element, centered
      e.dataTransfer.setDragImage(img, 40, 40);
    }
  };

  const handleDrop = (e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    // Don't allow dropping on pre-filled cells
    if (initialGridState[row][col] !== null) return;

    const flowerId = e.dataTransfer.getData('flowerId');
    const sourceRowStr = e.dataTransfer.getData('sourceRow');
    const sourceColStr = e.dataTransfer.getData('sourceCol');

    if (flowerId) {
      const newGrid = [...grid.map(r => [...r])];
      
      // If moving within grid, clear old position
      if (sourceRowStr && sourceColStr) {
        const sR = parseInt(sourceRowStr);
        const sC = parseInt(sourceColStr);
        newGrid[sR][sC] = null;
      }

      newGrid[row][col] = flowerId;
      setGrid(newGrid);
      setStatus('playing');
      setErrors(Array(3).fill(null).map(() => Array(3).fill(false)));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const checkSudoku = () => {
    const newErrors = Array(gridSize).fill(null).map(() => Array(gridSize).fill(false));
    let hasError = false;
    let isComplete = true;

    // 1. Check if all cells are filled
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (grid[r][c] === null) {
          isComplete = false;
        }
      }
    }

    if (!isComplete) {
      setStatus('incorrect');
      // Mark empty cells as errors if user tries to check an incomplete grid
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (grid[r][c] === null) newErrors[r][c] = true;
        }
      }
      setErrors(newErrors);
      return;
    }

    // 2. Check Rows
    for (let r = 0; r < gridSize; r++) {
      const rowValues = grid[r];
      const seen = new Set();
      const duplicates = new Set();
      rowValues.forEach(val => {
        if (seen.has(val)) duplicates.add(val);
        seen.add(val);
      });
      if (duplicates.size > 0) {
        hasError = true;
        for (let c = 0; c < gridSize; c++) {
          if (duplicates.has(grid[r][c])) newErrors[r][c] = true;
        }
      }
    }

    // 3. Check Columns
    for (let c = 0; c < gridSize; c++) {
      const colValues = [];
      for (let r = 0; r < gridSize; r++) {
        colValues.push(grid[r][c]);
      }
      const seen = new Set();
      const duplicates = new Set();
      colValues.forEach(val => {
        if (seen.has(val)) duplicates.add(val);
        seen.add(val);
      });
      if (duplicates.size > 0) {
        hasError = true;
        for (let r = 0; r < gridSize; r++) {
          if (duplicates.has(grid[r][c])) newErrors[r][c] = true;
        }
      }
    }

    if (!hasError && isComplete) {
      setStatus('correct');
      audioRef.current?.play().catch(err => console.log('Audio play failed:', err));
    } else {
      setStatus('incorrect');
      setErrors(newErrors);
    }
  };

  const resetGame = () => {
    if (status === 'correct') {
      startNewGame();
      return;
    }
    const newGrid = grid.map((row, r) => 
      row.map((cell, c) => {
        // Keep initial cells
        if (initialGridState[r][c] !== null) return cell;
        // Keep correct cells (matching the solution)
        if (cell === solution[r][c]) return cell;
        // Clear incorrect or empty cells
        return null;
      })
    );
    setGrid(newGrid);
    setStatus('playing');
    setErrors(Array(gridSize).fill(null).map(() => Array(gridSize).fill(false)));
  };

  const removeFlower = (row: number, col: number) => {
    if (initialGridState[row][col] !== null) return;
    const newGrid = [...grid.map(r => [...r])];
    newGrid[row][col] = null;
    setGrid(newGrid);
    setStatus('playing');
    setErrors(Array(gridSize).fill(null).map(() => Array(gridSize).fill(false)));
  };

  return (
    <div className="min-h-screen bg-[#fdf6e3] font-sans text-stone-800 p-2 md:p-4 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Settings Toggle - Only visible for admin */}
      {isAdmin && (
        <button 
          onClick={() => {
            setTempFlowers([...flowers]);
            setTempPreFilled(preFilledCount);
            setShowSettings(true);
          }}
          className="fixed top-4 right-4 p-3 bg-white rounded-full shadow-md hover:bg-stone-50 transition-colors z-40 border-2 border-blue-200"
        >
          <Settings size={24} className="text-blue-600" />
        </button>
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                <h2 className="text-2xl font-bold text-stone-800">Instellingen</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Image URLs */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-stone-700">Afbeeldingen</h3>
                  {tempFlowers.map((flower, idx) => (
                    <div key={flower.id} className="space-y-2 p-4 bg-stone-50 rounded-2xl border-2 border-stone-100">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-stone-500 font-bold uppercase tracking-wider">Bloem {idx + 1}</label>
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-stone-200">
                          <img src={flower.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={flower.url}
                              onChange={(e) => {
                                const newTemp = [...tempFlowers];
                                newTemp[idx] = { ...newTemp[idx], url: e.target.value };
                                setTempFlowers(newTemp);
                              }}
                              className="flex-1 p-2 bg-white border border-stone-200 rounded-lg text-sm outline-none focus:border-blue-400"
                              placeholder="URL of upload..."
                            />
                            <button
                              onClick={() => handleUrlUpload(idx, flower.url)}
                              disabled={downloadingIdx === idx}
                              title="Download en host deze afbeelding lokaal"
                              className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                            >
                              {downloadingIdx === idx ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            </button>
                          </div>
                          <input 
                            type="text" 
                            value={flower.source || ''}
                            onChange={(e) => {
                              const newTemp = [...tempFlowers];
                              newTemp[idx] = { ...newTemp[idx], source: e.target.value };
                              setTempFlowers(newTemp);
                            }}
                            className="w-full p-2 bg-white border border-stone-200 rounded-lg text-[10px] outline-none focus:border-blue-400 italic"
                            placeholder="Bron van de afbeelding (URL of tekst)..."
                          />
                        </div>
                        <label className="cursor-pointer bg-white border border-stone-200 hover:bg-stone-50 p-2 rounded-lg transition-colors flex items-center justify-center self-start">
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(idx, file);
                            }}
                          />
                          <Save size={16} className="text-stone-600" />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grid Size */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-stone-700">Sudoku Grootte</h3>
                  <div className="flex gap-4">
                    {[3, 4, 5].map((size) => (
                      <button
                        key={size}
                        onClick={() => {
                          setTempGridSize(size);
                          // Adjust pre-filled count if it exceeds new max
                          if (tempPreFilled > size * size) setTempPreFilled(Math.floor(size * size / 2));
                        }}
                        className={`
                          flex-1 py-3 rounded-2xl font-bold transition-all border-2
                          ${tempGridSize === size 
                            ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                            : 'bg-white border-stone-200 text-stone-600 hover:border-blue-200'}
                        `}
                      >
                        {size}x{size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-filled count */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-stone-700">Ingevulde vakjes</h3>
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-bold">{tempPreFilled}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max={tempGridSize * tempGridSize} 
                    value={tempPreFilled}
                    onChange={(e) => setTempPreFilled(parseInt(e.target.value))}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-bold uppercase">
                    <span>Leeg (0)</span>
                    <span>Vol ({tempGridSize * tempGridSize})</span>
                  </div>
                </div>

                {/* Save/Load Section */}
                <div className="pt-6 border-t border-stone-100 space-y-4">
                  <h3 className="font-semibold text-stone-700">Opgeslagen Versies</h3>
                  
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      className="flex-1 p-2 bg-stone-50 border border-stone-200 rounded-lg text-sm outline-none focus:border-blue-400"
                      placeholder="Naam voor deze versie..."
                    />
                    <button 
                      onClick={saveCurrentConfig}
                      disabled={isSaving}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                    >
                      {isSaving ? 'Bezig...' : 'Opslaan'}
                    </button>
                  </div>

                  <div className="space-y-2">
                    {savedConfigs.length === 0 ? (
                      <p className="text-sm text-stone-400 italic">Geen opgeslagen versies gevonden.</p>
                    ) : (
                      savedConfigs.map((config) => (
                        <div key={config.id} className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                          <div>
                            <p className="font-bold text-sm text-stone-700">{config.name}</p>
                            <p className="text-[10px] text-stone-400">{new Date(config.date).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => loadConfig(config)}
                              className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg font-bold text-xs hover:bg-blue-200 transition-colors"
                            >
                              Laden
                            </button>
                            <button 
                              onClick={() => deleteConfig(config.id)}
                              className="bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold text-xs hover:bg-red-200 transition-colors"
                            >
                              Verwijder
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-stone-50 border-t border-stone-100 flex flex-col gap-3">
                <button 
                  onClick={copyShareLink}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-bold shadow-md transition-all active:scale-95"
                >
                  Deel-link kopiëren
                </button>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setFlowers(tempFlowers);
                      setPreFilledCount(tempPreFilled);
                      setGridSize(tempGridSize);
                      setShowSettings(false);
                      startNewGame(tempFlowers, tempPreFilled, tempGridSize);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95"
                  >
                    <Save size={20} />
                    Opslaan & Nieuwe Puzzel
                  </button>
                  <button 
                    onClick={() => {
                      setFlowers(tempFlowers);
                      setPreFilledCount(tempPreFilled);
                      setGridSize(tempGridSize);
                      setShowSettings(false);
                    }}
                    className="px-6 flex items-center justify-center bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-2xl font-bold transition-all active:scale-95"
                  >
                    Alleen Opslaan
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex flex-col md:flex-row gap-4 md:gap-8 items-center md:items-stretch justify-center w-full max-w-6xl px-2 md:px-4">
        {/* Sudoku Grid */}
        <div className="bg-white p-2 md:p-4 rounded-2xl shadow-xl border-4 border-[#00736d] relative w-full max-w-[min(95vw,80vh)] aspect-square flex items-center justify-center">
          <div 
            className="grid gap-1 md:gap-2 bg-[#00736d] p-1 md:p-2 rounded-lg w-full h-full"
            style={{ 
              gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`
            }}
          >
            {grid.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const isInitial = initialGridState[rIdx][cIdx] !== null;
                const flower = flowers.find(f => f.id === cell);
                const hasError = errors[rIdx][cIdx];

                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    draggable={!isInitial && cell !== null}
                    onDragStart={(e) => cell && handleDragStart(e, cell, rIdx, cIdx)}
                    onDrop={(e) => handleDrop(e, rIdx, cIdx)}
                    onDragOver={handleDragOver}
                    onClick={() => removeFlower(rIdx, cIdx)}
                    className={`
                      aspect-square w-full rounded-lg md:rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200
                      ${isInitial ? 'bg-stone-100 cursor-default' : 'bg-white hover:bg-stone-50 shadow-sm'}
                      ${hasError && !isInitial ? 'ring-4 ring-red-400 bg-red-50' : 'border-2 border-stone-100'}
                      relative overflow-hidden group
                    `}
                  >
                    {flower && (
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full h-full p-0.5 md:p-1"
                      >
                        <FlowerImage flower={flower} />
                      </motion.div>
                    )}
                    {isInitial && (
                      <div className="absolute top-1 left-1 w-2.5 h-2.5 bg-stone-300 rounded-full opacity-40" />
                    )}
                    {!isInitial && !flower && (
                      <div className="absolute inset-0 bg-blue-400/0 group-hover:bg-blue-400/5 transition-colors" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Success Overlay */}
          <AnimatePresence>
            {status === 'correct' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 backdrop-blur-sm rounded-2xl"
              >
                <div className="bg-green-100 border-4 border-green-500 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 text-green-800">
                  <CheckCircle2 className="text-green-600" size={64} />
                  <p className="font-bold text-3xl text-center">Goed gedaan! 👏🏻</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Flower Palette */}
        <div className="bg-white p-2 md:p-4 rounded-2xl shadow-xl border-4 border-blue-200 flex flex-row md:flex-col gap-2 md:gap-4 items-center justify-center md:w-full md:max-w-[140px]">
          {flowers.slice(0, gridSize).map((flower) => (
            <div
              key={flower.id}
              draggable
              onDragStart={(e) => handleDragStart(e, flower.id)}
              className={`
                aspect-square w-14 h-14 md:w-full md:h-auto bg-blue-50 rounded-xl border-2 border-transparent 
                cursor-grab active:cursor-grabbing hover:scale-105 hover:bg-blue-100 hover:border-blue-300 
                transition-all duration-200 shadow-sm flex items-center justify-center p-1.5 md:p-2
              `}
            >
              <FlowerImage flower={flower} />
            </div>
          ))}
        </div>
      </main>

      {/* Controls */}
      <footer className="mt-12 flex flex-col items-center gap-6 w-full max-w-md">
        <div className="flex gap-4">
          <button
            onClick={checkSudoku}
            className="flex items-center gap-2 px-8 py-3 bg-[#00736d] hover:opacity-90 text-white rounded-full font-bold text-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            <CheckCircle2 size={24} />
            Controleer
          </button>
          
          <button
            onClick={resetGame}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-full font-bold text-xl shadow-lg transition-all active:scale-95
              ${status === 'incorrect' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white animate-blink' 
                : 'bg-stone-200 hover:bg-stone-300 text-stone-700'}
            `}
          >
            <RotateCcw size={20} />
            {status === 'incorrect' ? 'Verbeter' : 'Opnieuw'}
          </button>
        </div>
      </footer>

      {/* Background decoration */}
      <div className="fixed bottom-0 left-0 w-full h-24 bg-green-800/10 -z-10 pointer-events-none overflow-hidden">
        <div className="flex justify-around items-end h-full opacity-20">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="w-1 h-12 bg-green-600 rounded-t-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
