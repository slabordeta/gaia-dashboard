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
  const [showAll, setShowAll] = useState(false);
  
  // Mover carpetas
  const [movingNode, setMovingNode] = useState(null);
  const [moveTarget, setMoveTarget] = useState(null);
  
  // Lista de compra
  const [shoppingItems, setShoppingItems] = useState([]);
  const [showShopping, setShowShopping] = useState(false);
  const [addingShopping, setAddingShopping] = useState(false);
  const [newShoppingItem, setNewShoppingItem] = useState({
    description: '',
    units: 1,
    unit_price: '',
    store: '',
    link: ''
  });

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (currentFunction) {
      fetchNodes(currentFunction.id);
    }
  }, [currentFunction]);

  useEffect(() => {
    if (currentFunction) {
      fetchShoppingItems();
    }
  }, [currentFunction, currentPath]);

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

  const fetchShoppingItems = async () => {
    try {
      const currentNodeId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
      let url;
      
      if (currentNodeId) {
        url = `${API_URL}/shopping?node_id=${currentNodeId}&include_children=true`;
      } else {
        url = `${API_URL}/shopping?function_id=${currentFunction.id}`;
      }
      
      const res = await fetch(url);
      const data = await res.json();
      setShoppingItems(data);
    } catch (e) {
      console.error('Error fetching shopping items:', e);
    }
  };

  const getDescendants = (nodeId) => {
    const children = nodes.filter(n => n.parent_id === nodeId);
    let descendants = [...children];
    children.forEach(child => {
      descendants = [...descendants, ...getDescendants(child.id)];
    });
    return descendants;
  };

  const folderHasPendingTasks = (nodeId) => {
    const descendants = getDescendants(nodeId);
    return descendants.some(n => n.is_task && !n.completed);
  };

  const folderIsCompleted = (nodeId) => {
    const descendants = getDescendants(nodeId);
    const tasks = descendants.filter(n => n.is_task);
    return tasks.length > 0 && tasks.every(n => n.completed);
  };

  const getCurrentNodes = () => {
    let filtered;
    if (currentPath.length === 0) {
      filtered = nodes.filter(n => !n.parent_id);
    } else {
      const currentParentId = currentPath[currentPath.length - 1].id;
      filtered = nodes.filter(n => n.parent_id === currentParentId);
    }

    if (!showAll) {
      filtered = filtered.filter(n => {
        if (n.is_task) {
          return !n.completed;
        } else {
          return folderHasPendingTasks(n.id);
        }
      });
    }

    return filtered;
  };

  // Obtener carpetas disponibles para mover (excluyendo el nodo actual y sus descendientes)
  const getAvailableMoveTargets = () => {
    if (!movingNode) return [];
    
    const descendantIds = getDescendants(movingNode.id).map(n => n.id);
    const excluded = [movingNode.id, ...descendantIds];
    
    return nodes.filter(n => !n.is_task && !excluded.includes(n.id));
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
    setShowShopping(false);
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

  const toggleFolder = async (node) => {
    const descendants = getDescendants(node.id);
    const tasks = descendants.filter(n => n.is_task);
    const isCurrentlyCompleted = folderIsCompleted(node.id);
    const newStatus = !isCurrentlyCompleted;

    try {
      await Promise.all(tasks.map(task =>
        fetch(`${API_URL}/nodes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: task.id,
            completed: newStatus
          })
        })
      ));
      await fetchNodes(currentFunction.id);
    } catch (e) {
      console.error('Error toggling folder:', e);
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

  // Mover carpeta
  const moveNode = async () => {
    if (!movingNode) return;
    
    try {
      await fetch(`${API_URL}/nodes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: movingNode.id,
          parent_id: moveTarget // null = raíz
        })
      });
      await fetchNodes(currentFunction.id);
      setMovingNode(null);
      setMoveTarget(null);
    } catch (e) {
      console.error('Error moving node:', e);
    }
  };

  // Shopping functions
  const addShoppingItem = async () => {
    if (!newShoppingItem.description.trim()) return;
    
    const nodeId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : `root_${currentFunction.id}`;
    
    try {
      await fetch(`${API_URL}/shopping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: nodeId,
          function_id: currentFunction.id,
          ...newShoppingItem,
          unit_price: newShoppingItem.unit_price || null
        })
      });
      
      await fetchShoppingItems();
      setNewShoppingItem({ description: '', units: 1, unit_price: '', store: '', link: '' });
      setAddingShopping(false);
    } catch (e) {
      console.error('Error adding shopping item:', e);
    }
  };

  const toggleShoppingItem = async (item) => {
    try {
      await fetch(`${API_URL}/shopping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          purchased: !item.purchased
        })
      });
      await fetchShoppingItems();
    } catch (e) {
      console.error('Error toggling shopping item:', e);
    }
  };

  const deleteShoppingItem = async (itemId) => {
    try {
      await fetch(`${API_URL}/shopping?id=${itemId}`, {
        method: 'DELETE'
      });
      await fetchShoppingItems();
    } catch (e) {
      console.error('Error deleting shopping item:', e);
    }
  };

  const shoppingTotal = shoppingItems
    .filter(i => !i.purchased)
    .reduce((acc, item) => acc + (parseFloat(item.unit_price) || 0) * (item.units || 1), 0);

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
  const availableTargets = getAvailableMoveTargets();

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4 text-sm flex-wrap">
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

        {/* Filtros y toggle compra */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setShowAll(false)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              !showAll ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Pendiente
          </button>
          <button
            onClick={() => setShowAll(true)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ${
              showAll ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Todo
          </button>
          <button
            onClick={() => setShowShopping(!showShopping)}
            className={`px-4 py-2 rounded-lg text-sm transition-all ml-auto ${
              showShopping ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            🛒 Compra {shoppingItems.filter(i => !i.purchased).length > 0 && `(${shoppingItems.filter(i => !i.purchased).length})`}
          </button>
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

        {/* Modal mover carpeta */}
        {movingNode && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Mover "{movingNode.name}"</h3>
              
              <div className="space-y-2 mb-4">
                <button
                  onClick={() => setMoveTarget(null)}
                  className={`w-full p-3 rounded-lg text-left ${
                    moveTarget === null ? 'bg-emerald-600' : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  📂 Raíz de {currentFunction.name}
                </button>
                
                {availableTargets.map(target => (
                  <button
                    key={target.id}
                    onClick={() => setMoveTarget(target.id)}
                    className={`w-full p-3 rounded-lg text-left ${
                      moveTarget === target.id ? 'bg-emerald-600' : 'bg-gray-800 hover:bg-gray-700'
                    }`}
                  >
                    📁 {target.name}
                  </button>
                ))}
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={moveNode}
                  className="flex-1 p-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                >
                  Mover aquí
                </button>
                <button 
                  onClick={() => { setMovingNode(null); setMoveTarget(null); }}
                  className="px-4 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Carpetas y tareas */}
        <div className="space-y-3">
          {folders.map(node => {
            const isCompleted = folderIsCompleted(node.id);
            const descendantTasks = getDescendants(node.id).filter(n => n.is_task);
            const hasTasks = descendantTasks.length > 0;
            
            return (
              <div key={node.id} className={`flex items-center gap-2 ${isCompleted ? 'opacity-50' : ''}`}>
                {hasTasks && (
                  <button 
                    onClick={() => toggleFolder(node)}
                    className={`w-5 h-5 rounded border-2 transition-colors flex items-center justify-center flex-shrink-0
                      ${isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-500 hover:bg-emerald-500'}`}
                  >
                    {isCompleted && <span className="text-xs">✓</span>}
                  </button>
                )}
                {!hasTasks && <div className="w-5 h-5 flex-shrink-0" />}
                
                <button
                  onClick={() => navigate(node)}
                  className="flex-1 p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left flex items-center gap-3"
                >
                  <span>📁</span>
                  <span className={isCompleted ? 'line-through' : ''}>{node.name}</span>
                  {hasTasks && (
                    <span className="text-xs text-gray-500 ml-auto">
                      {descendantTasks.filter(t => !t.completed).length}/{descendantTasks.length}
                    </span>
                  )}
                </button>
                
                <button 
                  onClick={() => setMovingNode(node)}
                  className="p-3 text-gray-500 hover:text-blue-400 hover:bg-gray-800 rounded-lg"
                  title="Mover"
                >
                  ↔️
                </button>
                <button 
                  onClick={() => deleteNode(node.id)}
                  className="p-3 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg"
                >
                  🗑️
                </button>
              </div>
            );
          })}

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

          {currentNodes.length === 0 && !showShopping && (
            <div className="text-center text-gray-500 py-8">
              {showAll ? 'Vacío. Añade carpetas o tareas.' : 'No hay tareas pendientes.'}
            </div>
          )}
        </div>

        {/* Lista de compra - debajo de carpetas y tareas */}
        {showShopping && (
          <div className="mt-6 p-4 bg-amber-950/30 border border-amber-700/50 rounded-xl">
            <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
              🛒 Lista de la compra
              <span className="text-xs text-amber-600">
                ({currentPath.length > 0 ? 'esta carpeta y subcarpetas' : 'toda la función'})
              </span>
            </h3>
            
            {shoppingItems.length > 0 ? (
              <div className="space-y-2">
                {shoppingItems.map(item => (
                  <div 
                    key={item.id}
                    className={`p-3 bg-gray-900/50 rounded-lg ${item.purchased ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => toggleShoppingItem(item)}
                        className={`w-5 h-5 mt-0.5 rounded border-2 transition-colors flex items-center justify-center flex-shrink-0
                          ${item.purchased ? 'bg-amber-500 border-amber-500' : 'border-amber-500 hover:bg-amber-500'}`}
                      >
                        {item.purchased && <span className="text-xs">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={item.purchased ? 'line-through text-gray-500' : ''}>{item.description}</span>
                          {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" 
                               className="text-blue-400 hover:text-blue-300 text-xs">🔗</a>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                          <span>{item.units}x</span>
                          {item.unit_price && <span>{parseFloat(item.unit_price).toFixed(2)}€/u</span>}
                          {item.unit_price && <span className="text-amber-400">{(parseFloat(item.unit_price) * item.units).toFixed(2)}€</span>}
                          {item.store && <span>📍 {item.store}</span>}
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteShoppingItem(item.id)}
                        className="text-gray-500 hover:text-red-400 text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Total */}
                {shoppingTotal > 0 && (
                  <div className="pt-3 border-t border-amber-700/30 flex justify-between items-center">
                    <span className="text-amber-400 font-bold">Total pendiente:</span>
                    <span className="text-amber-400 font-bold text-lg">{shoppingTotal.toFixed(2)}€</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No hay artículos de compra aquí.</p>
            )}

            {/* Añadir artículo */}
            {!addingShopping ? (
              <button
                onClick={() => setAddingShopping(true)}
                className="mt-3 w-full p-2 border-2 border-dashed border-amber-700 hover:border-amber-500 rounded-lg text-amber-400 text-sm"
              >
                + Añadir artículo
              </button>
            ) : (
              <div className="mt-3 p-3 bg-gray-900 rounded-lg space-y-2">
                <input
                  type="text"
                  placeholder="Descripción *"
                  value={newShoppingItem.description}
                  onChange={(e) => setNewShoppingItem({...newShoppingItem, description: e.target.value})}
                  className="w-full p-2 bg-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Unidades"
                    value={newShoppingItem.units}
                    onChange={(e) => setNewShoppingItem({...newShoppingItem, units: parseInt(e.target.value) || 1})}
                    className="p-2 bg-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio/u (€)"
                    value={newShoppingItem.unit_price}
                    onChange={(e) => setNewShoppingItem({...newShoppingItem, unit_price: e.target.value})}
                    className="p-2 bg-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Tienda"
                    value={newShoppingItem.store}
                    onChange={(e) => setNewShoppingItem({...newShoppingItem, store: e.target.value})}
                    className="p-2 bg-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <input
                    type="url"
                    placeholder="Enlace (opcional)"
                    value={newShoppingItem.link}
                    onChange={(e) => setNewShoppingItem({...newShoppingItem, link: e.target.value})}
                    className="p-2 bg-gray-800 rounded text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={addShoppingItem} className="flex-1 p-2 bg-amber-600 hover:bg-amber-500 rounded text-sm">
                    ✓ Añadir
                  </button>
                  <button onClick={() => setAddingShopping(false)} className="px-4 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
