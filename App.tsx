
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  PlusIcon, 
  FileTextIcon, 
  Trash2Icon, 
  SendIcon, 
  BotIcon, 
  UserIcon, 
  Loader2Icon,
  SearchIcon,
  BookOpenIcon,
  XIcon,
  LayoutGridIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from 'lucide-react';
import { Document, Message, Chunk, Source } from './types';
import { chunkDocument, searchChunks } from './services/ragEngine';
import { askGemini } from './services/geminiService';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: 'Hello! I am your Multi-Document Assistant. Upload your files (txt, md, js, etc.) using the sidebar, and I can answer complex questions across all of them simultaneously.', 
      timestamp: Date.now() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [expandedSources, setExpandedSources] = useState<number[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsIndexing(true);
    const newDocs: Document[] = [];

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const id = Math.random().toString(36).substr(2, 9);
        const chunks = chunkDocument(id, file.name, text);
        
        newDocs.push({
          id,
          name: file.name,
          content: text,
          size: file.size,
          type: file.type || 'text/plain',
          lastModified: file.lastModified,
          chunks
        });
      } catch (err) {
        console.error(`Error reading file ${file.name}:`, err);
      }
    }

    setDocuments(prev => [...prev, ...newDocs]);
    setIsIndexing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const toggleSource = (idx: number) => {
    setExpandedSources(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userQuery = input.trim();
    setInput('');
    
    // Add user message
    const userMessage: Message = { role: 'user', content: userQuery, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // 1. Retrieval Step: Search across ALL documents
      const allChunks: Chunk[] = documents.flatMap(doc => doc.chunks);
      const relevantResults = searchChunks(userQuery, allChunks, 8);
      
      const context = relevantResults.length > 0 
        ? relevantResults.map(res => `[DOCUMENT: ${res.chunk.documentName}]\n${res.chunk.text}`).join('\n\n---\n\n')
        : "No relevant content found in the current document set.";

      const sources: Source[] = relevantResults.map(res => ({
        documentName: res.chunk.documentName,
        snippet: res.chunk.text.substring(0, 300) + '...'
      }));

      // 2. Generation Step: Gemini 3 Flash for speed and intelligence
      const response = await askGemini(userQuery, context, messages);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
        sources: sources.length > 0 ? sources : undefined
      }]);
    } catch (error) {
      console.error("Error processing query:", error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I encountered an issue while generating an answer. Please check your network or try again.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden selection:bg-indigo-100">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col relative shrink-0`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between overflow-hidden">
          <div className="flex items-center gap-3 whitespace-nowrap">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <BookOpenIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight leading-tight">DocuMind</h1>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">Multi-Doc RAG</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Knowledge Base</h2>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="group flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <PlusIcon size={14} className="group-hover:rotate-90 transition-transform" />
              Add
            </button>
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.md,.json,.csv,.js,.tsx,.ts,.html,.css,.py,.rs,.go"
            />
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                <FileTextIcon className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">No documents yet</p>
              <p className="text-xs text-slate-400 mt-1">Upload files to begin cross-document analysis</p>
            </div>
          ) : (
            <div className="space-y-2 px-1">
              {documents.map(doc => (
                <div key={doc.id} className="group flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl hover:shadow-md hover:border-indigo-200 transition-all cursor-default">
                  <div className="w-9 h-9 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                    <FileTextIcon className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{doc.name}</p>
                    <p className="text-[10px] font-medium text-slate-400">
                      {(doc.size / 1024).toFixed(1)} KB • {doc.chunks.length} segments
                    </p>
                  </div>
                  <button 
                    onClick={() => removeDocument(doc.id)}
                    className="p-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    title="Remove document"
                  >
                    <Trash2Icon size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {isIndexing && (
          <div className="p-4 bg-indigo-600 flex items-center gap-3">
            <Loader2Icon className="w-4 h-4 text-white animate-spin" />
            <span className="text-xs font-bold text-white">Shredding and Indexing...</span>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative bg-white">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-5 left-6 z-10 p-2.5 bg-white border border-slate-200 rounded-xl shadow-lg hover:shadow-xl hover:bg-slate-50 transition-all text-slate-600"
          >
            <LayoutGridIcon size={20} />
          </button>
        )}

        <header className="h-20 flex items-center px-8 border-b border-slate-100 shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 tracking-tight">Active Intelligence</h2>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase tracking-tighter border border-emerald-100">Live</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Querying {documents.length} document{documents.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Model</p>
              <p className="text-xs font-bold text-slate-700">Gemini 3 Flash</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : 'animate-in fade-in slide-in-from-bottom-2'}`}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white shadow-indigo-200' 
                  : 'bg-white text-slate-500 border border-slate-100 shadow-slate-100'
              }`}>
                {msg.role === 'user' ? <UserIcon size={22} /> : <BotIcon size={22} className="text-indigo-600" />}
              </div>
              
              <div className={`max-w-3xl flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-3`}>
                <div className={`p-5 rounded-3xl text-sm leading-relaxed shadow-sm transition-all ${
                  msg.role === 'user' 
                    ? 'bg-slate-800 text-white rounded-tr-none' 
                    : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-none'
                }`}>
                  <div className="prose prose-slate max-w-none prose-sm prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-100">
                    {msg.content.split('\n').map((line, i) => (
                      <p key={i} className={line.trim() === '' ? 'h-2' : 'mb-2 last:mb-0'}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Sources Section */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="w-full max-w-lg">
                    <button 
                      onClick={() => toggleSource(idx)}
                      className="flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                    >
                      {expandedSources.includes(idx) ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
                      Sources used ({msg.sources.length})
                    </button>
                    {expandedSources.includes(idx) && (
                      <div className="mt-2 space-y-2 animate-in zoom-in-95 duration-200">
                        {msg.sources.map((src, sIdx) => (
                          <div key={sIdx} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 mb-1.5">
                              <FileTextIcon size={12} className="text-indigo-500" />
                              <span className="text-[10px] font-bold text-slate-700 truncate">{src.documentName}</span>
                            </div>
                            <p className="text-[11px] text-slate-500 italic leading-relaxed line-clamp-2">
                              "...{src.snippet}..."
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex gap-5 animate-pulse">
              <div className="w-11 h-11 bg-slate-100 rounded-2xl shrink-0" />
              <div className="space-y-3 flex-1 max-w-md">
                <div className="h-4 bg-slate-100 rounded-full w-3/4" />
                <div className="h-4 bg-slate-100 rounded-full w-1/2" />
                <div className="h-4 bg-slate-100 rounded-full w-5/6" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-8 bg-white border-t border-slate-100">
          <form 
            onSubmit={handleSendMessage}
            className="max-w-4xl mx-auto relative group"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={documents.length > 0 ? "Ask about your documents..." : "Upload documents to start chatting"}
              disabled={documents.length === 0 || isProcessing}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-4 pr-16 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none min-h-[60px] max-h-[200px] shadow-sm group-hover:shadow-md disabled:opacity-50"
              rows={1}
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing || documents.length === 0}
              className="absolute right-3 bottom-3 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:bg-slate-300 disabled:shadow-none disabled:scale-100"
            >
              {isProcessing ? <Loader2Icon size={18} className="animate-spin" /> : <SendIcon size={18} />}
            </button>
          </form>
          <div className="max-w-4xl mx-auto mt-4 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
            <div className="flex gap-4">
              <span className="flex items-center gap-1"><SearchIcon size={10} /> Local Retrieval</span>
              <span className="flex items-center gap-1"><BotIcon size={10} /> Gemini 3 Flash</span>
            </div>
            <span>Cross-Document Context Enabled</span>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default App;
