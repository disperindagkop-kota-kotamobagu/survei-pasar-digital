'use client';
import { ReactNode, useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle2, Info, HelpCircle } from 'lucide-react';

interface ModernModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  type?: 'info' | 'confirm' | 'danger' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  children?: ReactNode;
  loading?: boolean;
}

export default function ModernModal({
  isOpen,
  onClose,
  title,
  description,
  type = 'info',
  confirmText = 'Lanjutkan',
  cancelText = 'Batal',
  onConfirm,
  children,
  loading = false
}: ModernModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      document.body.style.overflow = 'unset';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!mounted && !isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertCircle className="text-danger" size={28} />;
      case 'success': return <CheckCircle2 className="text-success" size={28} />;
      case 'confirm': return <HelpCircle className="text-warning" size={28} />;
      default: return <Info className="text-primary-light" size={28} />;
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? 'active' : ''}`} onClick={onClose}>
      <div 
        className={`modal-container modern-glass ${isOpen ? 'active' : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose}>
          <X size={20} />
        </button>

        <div className="modal-header-section">
          <div className="modal-icon-wrap">
            {getIcon()}
          </div>
          <div>
            <h3 className="modal-title">{title}</h3>
            {description && <p className="modal-desc">{description}</p>}
          </div>
        </div>

        <div className="modal-body-section">
          {children}
        </div>

        <div className="modal-footer-section">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button 
            className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`} 
            onClick={() => {
              if (onConfirm) onConfirm();
            }}
            disabled={loading}
          >
            {loading ? <span className="spinner-mini" /> : confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 10, 15, 0.4);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          opacity: 0;
          transition: all 0.3s ease;
          pointer-events: none;
        }
        .modal-overlay.active {
          opacity: 1;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          pointer-events: auto;
        }

        .modal-container {
          width: 100%;
          max-width: 440px;
          border-radius: 24px;
          padding: 32px;
          position: relative;
          transform: scale(0.9) translateY(20px);
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .modal-container.active {
          transform: scale(1) translateY(0);
          opacity: 1;
        }

        .modern-glass {
          background: rgba(25, 25, 35, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: none;
          color: var(--text-muted);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }
        .modal-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          transform: rotate(90deg);
        }

        .modal-header-section {
          display: flex;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .modal-icon-wrap {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.03);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .modal-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: var(--text-primary);
          margin-bottom: 4px;
        }

        .modal-desc {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .modal-body-section {
          margin-bottom: 32px;
        }

        .modal-footer-section {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .spinner-mini {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .modal-container {
            padding: 24px;
            border-radius: 32px 32px 0 0;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            transform: translateY(100%);
            max-width: none;
          }
          .modal-container.active {
            transform: translateY(0);
          }
          .modal-footer-section {
            flex-direction: column-reverse;
          }
          .btn {
            width: 100%;
            justify-content: center;
            height: 48px;
          }
        }
      `}</style>
    </div>
  );
}
