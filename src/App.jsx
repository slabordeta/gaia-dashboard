import React, { useState, useEffect } from 'react';

const API_URL = 'https://gaia-api-azure.vercel.app/api';

export default function App() {
  const [stats, setStats] = useState([]);
  const [nodes, setNodes] = useState([]);
  const [currentPath, setCurrentPath] = useState([]);
  const [currentFunction, setCurrentFunction] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [addingType, setAddingType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hadesActive, setHadesActive] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (currentFunction) {
      fetchNodes(currentFunction.id);
    }
  }, [currentFunction]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_URL}/stats`);
      const data = await res.json();
      setStats(data);
      setLoading(false);
    } catch (e) {
      console.error('Error fetching stats:', e);
      setLoading(false);
    }
  };

  const fetchNodes = async (functionId) => {
    try {
      const res = await fetch(`${API_URL}/nodes?function_id=${functionId}`);
      const data = await res.json();
      setNodes(data);
    } catch (e) {
      console.error('Error fetching nodes:', e);
    }
  };

  const getCurrentNodes = () => {
    if (currentPath.length === 0) {
      return nodes.filter(n => !n.parent_id);
    }
    const currentParentId = currentPath[currentPath.length - 1].id;
    return nodes.filter(n => n.parent_id === currentParentId);
  };

  const navigate = (node) => {
    if (!node.is_task) {
      setCurrentPath([...currentPath, node]);
    }
    setAddingType(null);
  };

  const goBack = () => {
    setCurrentPath(currentPath.slice(0, -1));
    setAddingType(null);
  };

  const goToRoot = () => {
    setCurrentPath([]);
    setCurrentFunction(null);
    setAddingType(null);
    fetchStats();
  };

  const enterFunction = (func) => {
    setCurrentFunction(func);
    setCurrentPath([]);
  };

  const addItem = async () => {
    if (!newItemName.trim()) return;

    const parentId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
    
    try {
      await fetch(`${API_URL}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          function_id: currentFunction.id,
          parent_id: parentId,
          name: newItemName,
          is_task: addingType === 'task'
        })
      });
      
      await fetchNodes(currentFunction.id);
      setNewItemName('');
      setAddingType(null);
    } catch (e) {
      console.error('Error adding item:', e);
    }
  };

  const toggleTask = async (node) => {
    try {
      await fetch(`${API_URL}/nodes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: node.id,
          completed: !node.completed
        })
      });
      await fetchNodes(currentFunction.id);
    } catch (e) {
      console.error('Error toggling task:', e);
    }
  };

  const deleteNode = async (nodeId) => {
    try {
      await fetch(`${API_URL}/nodes?id=${nodeId}`, {
        method: 'DELETE'
      });
      await fetchNodes(currentFunction.id);
    } catch (e) {
      console.error('Error deleting node:', e);
    }
  };

  const totalPending = stats.reduce((acc, s) => acc + parseInt(s.pending_tasks || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-xl">Cargando GAIA...</div>
      </div>
    );
  }

  if (!currentFunction) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              🌍 G A I A
            </h1>
            <p className="text-gray-400">Sistema de Gestión Vital</p>
            
            <button 
              onClick={() => setHadesActive(!hadesActive)}
              className={`mt-4 px-4 py-2 rounded-full text-sm transition-all ${
                hadesActive 
                  ? 'bg-red-900 text-red-300 ring-2 ring-red-500' 
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              }`}
            >
              {hadesActive ? '⚠️ HADES ACTIVO' : '🛡️ HADES contenido'}
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((func) => (
              <button
                key={func.id}
                onClick={() => enterFunction(func)}
                className={`p-4 rounded-xl bg-gradient-to-br ${func.color} 
                  hover:scale-105 transition-transform duration-200
                  flex flex-col items-center text-center`}
              >
                <span className="text-3xl mb-2">{func.icon}</span>
                <span className="font-bold text-sm">{func.name}</span>
                <span className="text-xs opacity-80 mt-1">
                  {func.pending_tasks} pendientes
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 p-4 bg-gray-900 rounded-xl">
            <h3 className="text-gray-400 text-sm mb-2">Estado del Sistema</h3>
            <div className="flex justify-between text-sm">
              <span>Tareas pendientes: {totalPending}</span>
              <span className={hadesActive ? 'text-red-400' : 'text-green-400'}>
                {hadesActive ? 'Sistema en crisis' : 'Sistema estable'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentNodes = getCurrentNodes();
  const folders = currentNodes.filter(n => !n.is_task);
  const tasks = currentNodes.filter(n => n.is_task);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-sm flex-wrap">
          <button onClick={goToRoot} className="hover:text-emerald-400">🌍 GAIA</button>
          <span className="text-gray-600">/</span>
          <button 
            onClick={() => setCurrentPath([])}
            className={`hover:text-emerald-400 ${currentPath.length === 0 ? 'text-emerald-400' : ''}`}
          >
            {currentFunction.icon} {currentFunction.name}
          </button>
          {currentPath.map((node, i) => (
            <React.Fragment key={node.id}>
              <span className="text-gray-600">/</span>
              <button 
                onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
                className={`hover:text-emerald-400 ${i === currentPath.length - 1 ? 'text-emerald-400' : ''}`}
              >
                📁 {node.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {currentPath.length === 0 && (
          <div className={`p-4 rounded-xl bg-gradient-to-r ${currentFunction.color} mb-6`}>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{currentFunction.icon}</span>
              <div>
                <h2 className="text-xl font-bold">{currentFunction.name}</h2>
                <p className="text-sm opacity-90">{currentFunction.mission}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {folders.map(node => (
            <div key={node.id} className="flex items-center gap-2">
              <button
                onClick={() => navigate(node)}
                className="flex-1 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left flex items-center gap-3"
              >
                <span>📁</span>
                <span>{node.name}</span>
              </button>
              <button 
                onClick={() => deleteNode(node.id)}
                className="p-3 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg"
              >
                🗑️
              </button>
            </div>
          ))}

          {tasks.map(node => (
            <div 
              key={node.id}
              className={`p-3 bg-gray-900 rounded-lg flex items-center gap-3 ${node.completed ? 'opacity-50' : ''}`}
            >
              <button 
                onClick={() => toggleTask(node)}
                className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center
                  ${node.completed ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-500 hover:bg-emerald-500'}`}
              >
                {node.completed && <span className="text-xs">✓</span>}
              </button>
              <span className={node.completed ? 'line-through' : ''}>{node.name}</span>
              <button 
                onClick={() => deleteNode(node.id)}
                className="ml-auto p-1 text-gray-500 hover:text-red-400"
              >
                🗑️
              </button>
            </div>
          ))}

          {currentNodes.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Vacío. Añade carpetas o tareas.
            </div>
          )}
        </div>

        {!addingType ? (
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setAddingType('folder')}
              className="flex-1 p-3 border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg text-gray-400"
            >
              + Carpeta
            </button>
            <button
              onClick={() => setAddingType('task')}
              className="flex-1 p-3 border-2 border-dashed border-emerald-700 hover:border-emerald-500 rounded-lg text-emerald-400"
            >
              + Tarea
            </button>
          </div>
        ) : (
          <div className="mt-6 flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              placeholder={addingType === 'folder' ? 'Nombre de carpeta...' : 'Nueva tarea...'}
              className="flex-1 p-3 bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
            <button onClick={addItem} className="px-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg">
              ✓
            </button>
            <button onClick={() => setAddingType(null)} className="px-4 bg-gray-700 hover:bg-gray-600 rounded-lg">
              ✕
            </button>
          </div>
        )}

        <button
          onClick={currentPath.length > 0 ? goBack : goToRoot}
          className="mt-6 text-gray-400 hover:text-white flex items-center gap-2"
        >
          ← Volver
        </button>
      </div>
    </div>
  );
}
