import { useState, useEffect, useCallback } from 'react';
import { sitesApi, BACKEND_URL } from '../services/api';

export function useSites(token, user, onConversationsCleared) {
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [showNewSiteModal, setShowNewSiteModal] = useState(false);
  const [newSiteForm, setNewSiteForm] = useState({ name: '', domain: '' });
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Site Details form (Website Property Settings)
  const [siteDetailsForm, setSiteDetailsForm] = useState({ name: '', domain: '' });
  const [savingSiteDetails, setSavingSiteDetails] = useState(false);
  const [siteDetailsMessage, setSiteDetailsMessage] = useState(null);

  // Modals
  const [changeDomainModal, setChangeDomainModal] = useState({
    open: false,
    domain: '',
    error: '',
    loading: false
  });
  const [deleteSiteModal, setDeleteSiteModal] = useState({
    open: false,
    site: null,
    password: '',
    error: '',
    loading: false
  });
  const [deleteChatsModal, setDeleteChatsModal] = useState({
    open: false,
    site: null,
    password: '',
    error: '',
    loading: false
  });

  // Fetch Sites
  const fetchSites = useCallback(async () => {
    if (!token) return;
    try {
      const data = await sitesApi.getAll();
      setSites(data);
      if (data.length > 0) {
        setActiveSite(prev => prev ? (data.find(s => s.id === prev.id) || data[0]) : data[0]);
      } else {
        setActiveSite(null);
      }
    } catch (e) {
      console.error('Error fetching sites:', e);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      fetchSites();
    } else {
      setSites([]);
      setActiveSite(null);
    }
  }, [user, token, fetchSites]);

  // Sync siteDetailsForm when activeSite changes
  useEffect(() => {
    if (activeSite) {
      setSiteDetailsForm({
        name: activeSite.name || '',
        domain: activeSite.domain || ''
      });
      setSiteDetailsMessage(null);
    }
  }, [activeSite]);

  // Create Site
  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!newSiteForm.name || !newSiteForm.domain) return;
    try {
      const created = await sitesApi.create(newSiteForm);
      setSites(prev => [created, ...prev]);
      setActiveSite(created);
      setShowNewSiteModal(false);
      setNewSiteForm({ name: '', domain: '' });
    } catch (e) {
      alert(e.message);
    }
  };

  // Update Site Name
  const handleUpdateSiteName = async (e) => {
    e.preventDefault();
    if (!activeSite || !token || savingSiteDetails) return;
    if (!siteDetailsForm.name.trim()) {
      setSiteDetailsMessage({ type: 'error', text: 'Website name cannot be empty.' });
      return;
    }

    setSavingSiteDetails(true);
    setSiteDetailsMessage(null);
    try {
      const data = await sitesApi.update(activeSite.id, {
        name: siteDetailsForm.name.trim()
      });
      if (data.site) {
        setActiveSite(data.site);
        setSites(prev => prev.map(s => s.id === data.site.id ? data.site : s));
        setSiteDetailsMessage({
          type: 'success',
          text: 'Website name updated successfully.'
        });
        setTimeout(() => setSiteDetailsMessage(null), 4000);
      }
    } catch (err) {
      setSiteDetailsMessage({ type: 'error', text: err.message || 'Network error updating website property.' });
    } finally {
      setSavingSiteDetails(false);
    }
  };

  // Change Domain Modal Handlers
  const promptChangeDomain = () => {
    if (!activeSite) return;
    setChangeDomainModal({
      open: true,
      domain: activeSite.domain,
      error: '',
      loading: false
    });
  };

  const handleConfirmChangeDomain = async (e) => {
    e.preventDefault();
    if (!activeSite || !token || changeDomainModal.loading) return;
    const newDomain = changeDomainModal.domain.trim();
    if (!newDomain) {
      setChangeDomainModal(prev => ({ ...prev, error: 'Domain URL cannot be empty.' }));
      return;
    }

    setChangeDomainModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await sitesApi.update(activeSite.id, { domain: newDomain });
      if (data.site) {
        setActiveSite(data.site);
        setSites(prev => prev.map(s => s.id === data.site.id ? data.site : s));
        setSiteDetailsForm(prev => ({ ...prev, domain: data.site.domain }));
        setChangeDomainModal({ open: false, domain: '', error: '', loading: false });
        setSiteDetailsMessage({ type: 'success', text: 'Domain URL updated successfully in Danger Zone.' });
        setTimeout(() => setSiteDetailsMessage(null), 4000);
      }
    } catch (err) {
      setChangeDomainModal(prev => ({ ...prev, loading: false, error: err.message || 'Network error updating domain.' }));
    }
  };

  // Delete Site Handlers
  const promptDeleteSite = (siteToDelete) => {
    const target = siteToDelete || activeSite;
    if (!target) return;
    setDeleteSiteModal({
      open: true,
      site: target,
      password: '',
      error: '',
      loading: false
    });
  };

  const handleConfirmDeleteSite = async (e) => {
    e.preventDefault();
    if (!deleteSiteModal.site || !token) return;
    if (!deleteSiteModal.password) {
      setDeleteSiteModal(prev => ({ ...prev, error: 'Please enter your admin password' }));
      return;
    }

    setDeleteSiteModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      await sitesApi.delete(deleteSiteModal.site.id, deleteSiteModal.password);
      const remaining = sites.filter(s => s.id !== deleteSiteModal.site.id);
      setSites(remaining);
      if (activeSite?.id === deleteSiteModal.site.id) {
        setActiveSite(remaining.length > 0 ? remaining[0] : null);
      }
      setDeleteSiteModal({ open: false, site: null, password: '', error: '', loading: false });
    } catch (e) {
      setDeleteSiteModal(prev => ({
        ...prev,
        loading: false,
        error: e.message || 'Failed to delete website property'
      }));
    }
  };

  // Clear Chats Handlers
  const promptDeleteChats = (site) => {
    const target = site || activeSite;
    if (!target) return;
    setDeleteChatsModal({
      open: true,
      site: target,
      password: '',
      error: '',
      loading: false
    });
  };

  const handleConfirmDeleteChats = async (e) => {
    e.preventDefault();
    if (!deleteChatsModal.site || !token) return;
    if (!deleteChatsModal.password) {
      setDeleteChatsModal(prev => ({ ...prev, error: 'Please enter your admin password' }));
      return;
    }

    setDeleteChatsModal(prev => ({ ...prev, loading: true, error: '' }));
    try {
      await sitesApi.clearConversations(deleteChatsModal.site.id, deleteChatsModal.password);
      if (typeof onConversationsCleared === 'function') {
        onConversationsCleared();
      }
      setDeleteChatsModal({ open: false, site: null, password: '', error: '', loading: false });
    } catch (e) {
      setDeleteChatsModal(prev => ({
        ...prev,
        loading: false,
        error: e.message || 'Failed to delete conversations'
      }));
    }
  };

  // Copy embed snippet helper
  const copyEmbedCode = () => {
    if (!activeSite) return;
    const code = `<script src="${BACKEND_URL}/sitepulse.js" data-site-key="${activeSite.apiKey}" defer></script>`;
    navigator.clipboard.writeText(code);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return {
    sites,
    setSites,
    activeSite,
    setActiveSite,
    fetchSites,
    showNewSiteModal,
    setShowNewSiteModal,
    newSiteForm,
    setNewSiteForm,
    handleCreateSite,
    siteDetailsForm,
    setSiteDetailsForm,
    savingSiteDetails,
    siteDetailsMessage,
    setSiteDetailsMessage,
    handleUpdateSiteName,
    changeDomainModal,
    setChangeDomainModal,
    promptChangeDomain,
    handleConfirmChangeDomain,
    deleteSiteModal,
    setDeleteSiteModal,
    promptDeleteSite,
    handleConfirmDeleteSite,
    deleteChatsModal,
    setDeleteChatsModal,
    promptDeleteChats,
    handleConfirmDeleteChats,
    copiedSnippet,
    copyEmbedCode
  };
}
