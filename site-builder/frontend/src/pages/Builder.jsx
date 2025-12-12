/**
 * ===========================================
 * Page principale du Builder - Version complète
 * ===========================================
 */

import { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { projectApi, pageApi, formApi } from '../services/api';

// Composants Builder
import BuilderHeader from '../components/Builder/BuilderHeader';
import PageManager from '../components/Builder/PageManager';
import GrapesEditor from '../components/Builder/GrapesEditor';
import Toast from '../components/common/Toast';
import Loading from '../components/common/Loading';

// Panneaux
import SeoPanel from '../components/Builder/SeoPanel';
import DesignSystemPanel from '../components/Builder/DesignSystemPanel';
import ScriptsPanel from '../components/Builder/ScriptsPanel';
import TemplateSelector from '../components/Builder/TemplateSelector';
import FormSubmissions from '../components/Builder/FormSubmissions';

// Icônes (emoji pour simplicité)
const icons = {
  blocks: '🧱',
  pages: '📄',
  layers: '📚',
  templates: '🎨',
  design: '🎯',
  seo: '🔍',
  scripts: '⚡',
  messages: '✉️',
  settings: '⚙️'
};

function Builder() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, project: contextProject, setProject } = useContext(AuthContext);

  // États principaux
  const [project, setLocalProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState('blocks');
  const [toasts, setToasts] = useState([]);
  const [editor, setEditor] = useState(null);

  // Panneaux ouverts
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDesignSystem, setShowDesignSystem] = useState(false);
  const [showSeoPanel, setShowSeoPanel] = useState(false);
  const [showScriptsPanel, setShowScriptsPanel] = useState(false);
  const [showMessages, setShowMessages] = useState(false);

  // Compteur de nouveaux messages
  const [newMessagesCount, setNewMessagesCount] = useState(0);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // Charger le projet
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        const id = projectId || contextProject?.id;
        
        if (!id) {
          navigate('/error?message=Aucun projet sélectionné');
          return;
        }

        const response = await projectApi.get(id);
        
        if (response.data.success) {
          const projectData = response.data.data.project;
          setLocalProject(projectData);
          setProject(projectData);
          setPages(projectData.pages || []);
          
          if (projectData.pages?.length > 0) {
            const homePage = projectData.pages.find(p => p.is_homepage) || projectData.pages[0];
            setCurrentPage(homePage);
          }

          // Charger le nombre de nouveaux messages
          try {
            const msgResponse = await formApi.countNew(id);
            if (msgResponse.data.success) {
              setNewMessagesCount(msgResponse.data.data.count);
            }
          } catch (e) {
            // Ignorer l'erreur si la table n'existe pas encore
          }
        }
      } catch (error) {
        console.error('Erreur chargement projet:', error);
        showToast('Erreur lors du chargement du projet', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [projectId, contextProject?.id, navigate, setProject, showToast]);

  // Sauvegarder la page
  const handleSave = useCallback(async () => {
    if (!editor || !currentPage || !project) return;

    try {
      setSaving(true);

      const grapesjs_data = {
        components: editor.getComponents().map(c => c.toJSON()),
        styles: editor.getStyle().map(s => s.toJSON()),
        assets: editor.AssetManager.getAll().map(a => a.toJSON())
      };

      await pageApi.update(project.id, currentPage.id, { grapesjs_data });

      setPages(prev => prev.map(p => 
        p.id === currentPage.id ? { ...p, grapesjs_data } : p
      ));

      showToast('Page sauvegardée', 'success');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      showToast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }, [editor, currentPage, project, showToast]);

  // Publier le site
  const handlePublish = useCallback(async () => {
    if (!project) return;

    try {
      setPublishing(true);
      await handleSave();

      const response = await projectApi.publish(project.id);

      if (response.data.success) {
        showToast('Site publié avec succès !', 'success');
        setLocalProject(prev => ({
          ...prev,
          is_published: true,
          last_published_at: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Erreur publication:', error);
      showToast(`Erreur: ${error.response?.data?.message || 'Publication échouée'}`, 'error');
    } finally {
      setPublishing(false);
    }
  }, [project, handleSave, showToast]);

  // Changer de page
  const handlePageChange = useCallback(async (page) => {
    if (page.id === currentPage?.id) return;

    try {
      if (editor && currentPage) {
        await handleSave();
      }

      const response = await pageApi.get(project.id, page.id);
      
      if (response.data.success) {
        const pageData = response.data.data.page;
        setCurrentPage(pageData);

        if (editor) {
          editor.setComponents(pageData.grapesjs_data?.components || []);
          editor.setStyle(pageData.grapesjs_data?.styles || []);
        }
      }
    } catch (error) {
      console.error('Erreur changement de page:', error);
      showToast('Erreur lors du chargement de la page', 'error');
    }
  }, [currentPage, editor, project, handleSave, showToast]);

  // Ajouter une page
  const handleAddPage = useCallback(async (name) => {
    if (!project) return;

    try {
      const response = await pageApi.create(project.id, { name });
      
      if (response.data.success) {
        const newPage = response.data.data.page;
        setPages(prev => [...prev, newPage]);
        showToast('Page créée', 'success');
        handlePageChange(newPage);
      }
    } catch (error) {
      console.error('Erreur création page:', error);
      showToast('Erreur lors de la création', 'error');
    }
  }, [project, handlePageChange, showToast]);

  // Supprimer une page
  const handleDeletePage = useCallback(async (pageId) => {
    if (!project || pages.length <= 1) {
      showToast('Impossible de supprimer la dernière page', 'warning');
      return;
    }

    try {
      await pageApi.delete(project.id, pageId);
      const updatedPages = pages.filter(p => p.id !== pageId);
      setPages(updatedPages);
      
      if (currentPage?.id === pageId) {
        handlePageChange(updatedPages[0]);
      }
      
      showToast('Page supprimée', 'success');
    } catch (error) {
      showToast('Erreur lors de la suppression', 'error');
    }
  }, [project, pages, currentPage, handlePageChange, showToast]);

  // Dupliquer une page
  const handleDuplicatePage = useCallback(async (pageId) => {
    if (!project) return;

    try {
      const response = await pageApi.duplicate(project.id, pageId);
      
      if (response.data.success) {
        const newPage = response.data.data.page;
        setPages(prev => [...prev, newPage]);
        showToast('Page dupliquée', 'success');
      }
    } catch (error) {
      showToast('Erreur lors de la duplication', 'error');
    }
  }, [project, showToast]);

  // Appliquer un template
  const handleSelectTemplate = useCallback(async (template) => {
    if (!editor || !template) return;
    
    // Appliquer le contenu de la première page du template
    if (template.pages && template.pages[0]) {
      const pageContent = template.pages[0].content;
      editor.setComponents(pageContent);
    }
    
    // Appliquer les settings
    if (template.settings) {
      await projectApi.update(project.id, { settings: template.settings });
      setLocalProject(prev => ({ ...prev, settings: template.settings }));
    }
    
    showToast('Template appliqué !', 'success');
  }, [editor, project, showToast]);

  // Sauvegarder le SEO
  const handleSaveSeo = useCallback(async (seoData) => {
    if (!currentPage || !project) return;
    
    try {
      await pageApi.update(project.id, currentPage.id, seoData);
      setCurrentPage(prev => ({ ...prev, ...seoData }));
      setPages(prev => prev.map(p => 
        p.id === currentPage.id ? { ...p, ...seoData } : p
      ));
      showToast('SEO mis à jour', 'success');
    } catch (error) {
      showToast('Erreur lors de la mise à jour SEO', 'error');
    }
  }, [currentPage, project, showToast]);

  // Sauvegarder le Design System
  const handleSaveDesign = useCallback(async (designData) => {
    if (!project) return;
    
    try {
      const newSettings = { ...project.settings, ...designData };
      await projectApi.update(project.id, { settings: newSettings });
      setLocalProject(prev => ({ ...prev, settings: newSettings }));
      showToast('Design System sauvegardé', 'success');
    } catch (error) {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  }, [project, showToast]);

  // Sauvegarder les scripts
  const handleSaveScripts = useCallback(async (scriptsData) => {
    if (!project) return;
    
    try {
      const newSettings = { ...project.settings, ...scriptsData };
      await projectApi.update(project.id, { settings: newSettings });
      setLocalProject(prev => ({ ...prev, settings: newSettings }));
      showToast('Scripts sauvegardés', 'success');
    } catch (error) {
      showToast('Erreur lors de la sauvegarde', 'error');
    }
  }, [project, showToast]);

  if (loading) {
    return (
      <div className="builder-loading">
        <Loading message="Chargement du builder..." />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="builder-error">
        <h2>Projet non trouvé</h2>
        <p>Le projet demandé n'existe pas ou vous n'y avez pas accès.</p>
      </div>
    );
  }

  return (
    <div className="builder-container">
      {/* Header */}
      <BuilderHeader
        project={project}
        currentPage={currentPage}
        onSave={handleSave}
        onPublish={handlePublish}
        saving={saving}
        publishing={publishing}
        user={user}
      />

      {/* Barre d'outils secondaire */}
      <div className="builder-toolbar">
        <div className="toolbar-left">
          <button 
            className="toolbar-btn"
            onClick={() => setShowTemplates(true)}
            title="Templates"
          >
            {icons.templates} Templates
          </button>
          <button 
            className="toolbar-btn"
            onClick={() => setShowDesignSystem(true)}
            title="Design System"
          >
            {icons.design} Design
          </button>
        </div>
        <div className="toolbar-right">
          <button 
            className="toolbar-btn"
            onClick={() => setShowSeoPanel(true)}
            title="SEO"
          >
            {icons.seo} SEO
          </button>
          <button 
            className="toolbar-btn"
            onClick={() => setShowScriptsPanel(true)}
            title="Scripts & Analytics"
          >
            {icons.scripts} Scripts
          </button>
          <button 
            className="toolbar-btn"
            onClick={() => setShowMessages(true)}
            title="Messages"
          >
            {icons.messages} Messages
            {newMessagesCount > 0 && (
              <span className="badge">{newMessagesCount}</span>
            )}
          </button>
        </div>
      </div>

      <div className="builder-main">
        {/* Sidebar gauche */}
        <div className="builder-sidebar">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${activeTab === 'blocks' ? 'active' : ''}`}
              onClick={() => setActiveTab('blocks')}
              title="Blocs"
            >
              {icons.blocks}
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'pages' ? 'active' : ''}`}
              onClick={() => setActiveTab('pages')}
              title="Pages"
            >
              {icons.pages}
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'layers' ? 'active' : ''}`}
              onClick={() => setActiveTab('layers')}
              title="Couches"
            >
              {icons.layers}
            </button>
          </div>

          <div className="sidebar-content">
            <div 
              id="blocks-container" 
              className="sidebar-panel"
              style={{ display: activeTab === 'blocks' ? 'block' : 'none' }}
            />
            
            <div 
              id="layers-container" 
              className="sidebar-panel"
              style={{ display: activeTab === 'layers' ? 'block' : 'none' }}
            />

            <div
              className="sidebar-panel"
              style={{ display: activeTab === 'pages' ? 'block' : 'none' }}
            >
              <PageManager
                pages={pages}
                currentPage={currentPage}
                onPageSelect={handlePageChange}
                onAddPage={handleAddPage}
                onDeletePage={handleDeletePage}
                onDuplicatePage={handleDuplicatePage}
              />
            </div>
          </div>
        </div>

        {/* Zone d'édition */}
        <div className="editor-canvas">
          <GrapesEditor
            currentPage={currentPage}
            projectSettings={project.settings}
            projectId={project.id}
            onEditorReady={setEditor}
          />
        </div>

        {/* Panneau droit - Styles */}
        <div className="builder-panel-right">
          <div className="panel-section">
            <h3 className="panel-title">{icons.settings} Styles</h3>
            <div id="styles-container"></div>
          </div>
          <div className="panel-section">
            <h3 className="panel-title">⚙️ Propriétés</h3>
            <div id="traits-container"></div>
          </div>
          <div id="selectors-container" style={{ display: 'none' }}></div>
        </div>
      </div>

      {/* Panneaux modaux */}
      {showTemplates && (
        <TemplateSelector
          onSelectTemplate={handleSelectTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {showDesignSystem && (
        <DesignSystemPanel
          settings={project.settings}
          onSave={handleSaveDesign}
          onClose={() => setShowDesignSystem(false)}
        />
      )}

      {showSeoPanel && (
        <SeoPanel
          page={currentPage}
          onSave={handleSaveSeo}
          onClose={() => setShowSeoPanel(false)}
        />
      )}

      {showScriptsPanel && (
        <ScriptsPanel
          settings={project.settings}
          onSave={handleSaveScripts}
          onClose={() => setShowScriptsPanel(false)}
        />
      )}

      {showMessages && (
        <FormSubmissions
          projectId={project.id}
          onClose={() => {
            setShowMessages(false);
            setNewMessagesCount(0);
          }}
        />
      )}

      {/* Notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
          />
        ))}
      </div>

      <style>{`
        .builder-loading,
        .builder-error {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #1a1a2e;
          color: white;
        }
        
        .builder-error h2 {
          margin-bottom: 8px;
        }
        
        .builder-error p {
          color: #9ca3af;
        }

        .builder-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: #16213e;
          border-bottom: 1px solid #0f3460;
        }
        
        .toolbar-left,
        .toolbar-right {
          display: flex;
          gap: 8px;
        }
        
        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid #0f3460;
          border-radius: 6px;
          color: #e4e4e7;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }
        
        .toolbar-btn:hover {
          background: rgba(255,255,255,0.1);
          border-color: #3b82f6;
        }
        
        .badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #ef4444;
          color: white;
          font-size: 11px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }
        
        .sidebar-tab {
          font-size: 20px !important;
        }
      `}</style>
    </div>
  );
}

export default Builder;
