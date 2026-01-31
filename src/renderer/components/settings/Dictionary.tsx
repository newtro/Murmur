import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search } from 'lucide-react';

interface DictionaryEntry {
  id: number;
  term: string;
  replacement: string;
}

export function Dictionary() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDictionary();
  }, []);

  const loadDictionary = async () => {
    try {
      // TODO: Implement IPC call to load dictionary from main process
      // For now, use mock data
      setEntries([
        { id: 1, term: 'gonna', replacement: 'going to' },
        { id: 2, term: 'wanna', replacement: 'want to' },
        { id: 3, term: 'kinda', replacement: 'kind of' },
      ]);
    } catch (error) {
      console.error('Failed to load dictionary:', error);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async () => {
    if (!newTerm.trim() || !newReplacement.trim()) return;

    const entry: DictionaryEntry = {
      id: Date.now(),
      term: newTerm.trim().toLowerCase(),
      replacement: newReplacement.trim(),
    };

    setEntries((prev) => [...prev, entry]);
    setNewTerm('');
    setNewReplacement('');

    // TODO: Implement IPC call to save to database
  };

  const removeEntry = async (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    // TODO: Implement IPC call to remove from database
  };

  const filteredEntries = entries.filter(
    (entry) =>
      entry.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.replacement.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-2">Personal Dictionary</h2>
        <p className="text-gray-400 text-sm">
          Add custom words and phrases for better transcription accuracy.
          These will be automatically replaced during processing.
        </p>
      </div>

      {/* Add New Entry */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <h3 className="font-medium">Add New Entry</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Term (what you say)
            </label>
            <input
              type="text"
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="e.g., gonna"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Replacement (what gets typed)
            </label>
            <input
              type="text"
              value={newReplacement}
              onChange={(e) => setNewReplacement(e.target.value)}
              placeholder="e.g., going to"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
            />
          </div>
        </div>

        <button
          onClick={addEntry}
          disabled={!newTerm.trim() || !newReplacement.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Entry
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search dictionary..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-blue-500 outline-none"
        />
      </div>

      {/* Dictionary Entries */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            {searchQuery
              ? 'No entries match your search'
              : 'No dictionary entries yet. Add some above!'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                  Term
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                  Replacement
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-gray-700/50 last:border-0"
                >
                  <td className="px-4 py-3 text-sm font-mono">{entry.term}</td>
                  <td className="px-4 py-3 text-sm">{entry.replacement}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Tips */}
      <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-sm">Tips</h4>
        <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
          <li>Add technical terms, names, and abbreviations you use frequently</li>
          <li>Use lowercase for terms as matching is case-insensitive</li>
          <li>Replacements can include proper capitalization and punctuation</li>
          <li>Common contractions like "gonna" → "going to" improve clarity</li>
        </ul>
      </div>
    </div>
  );
}
