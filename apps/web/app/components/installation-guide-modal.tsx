"use client";

import { useEffect, useState } from "react";

type InstallStep = {
  id: string;
  title: string;
  label: string;
  summary: string;
};

type InstallationGuideModalProps = {
  downloadPath: string;
};

const installSteps: InstallStep[] = [
  {
    id: "01",
    title: "Baixe o arquivo ZIP",
    label: "Download",
    summary: "Baixe o arquivo oddzone-extension.zip na landing."
  },
  {
    id: "02",
    title: "Extraia a pasta da extensao",
    label: "Extrair",
    summary: "Descompacte o ZIP e mantenha a pasta em local fixo."
  },
  {
    id: "03",
    title: "Abra o painel de extensoes",
    label: "Painel",
    summary: "No Chrome, acesse chrome://extensions e ative o modo dev."
  },
  {
    id: "04",
    title: "Carregue a pasta descompactada",
    label: "Instalar",
    summary: "Clique em Carregar sem compactacao e selecione a pasta."
  }
];

function InstallMotionScene({ stepId }: { stepId: string }) {
  if (stepId === "01") {
    return (
      <div className="install-motion-scene scene-step-01" aria-hidden>
        <div className="scene-browser-topbar">
          <span />
          <span />
          <span />
        </div>
        <div className="scene-address-bar">oddzone.app</div>
        <div className="scene-step-body">
          <div className="scene-hero">
            <div className="scene-title-line" />
            <div className="scene-title-line short" />
            <div className="scene-download-button">Baixar extensao (.zip)</div>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "02") {
    return (
      <div className="install-motion-scene scene-step-02" aria-hidden>
        <div className="scene-browser-topbar">
          <span />
          <span />
          <span />
        </div>
        <div className="scene-address-bar">Downloads</div>
        <div className="scene-step-body">
          <div className="scene-dropzone">Extrair oddzone-extension.zip</div>
          <div className="scene-confirm-dialog">
            <div className="scene-dialog-title">Pasta extraida</div>
            <div className="scene-file-picker">
              <div className="scene-file-picker-sidebar">
                <span>Acesso rapido</span>
                <span>Downloads</span>
                <span>Documentos</span>
              </div>
              <div className="scene-file-picker-main">
                <div className="scene-picker-path">Este Computador &gt; Downloads</div>
                <div className="scene-picker-folder">oddzone-extension.zip</div>
                <div className="scene-picker-folder is-target">oddzone-extension</div>
                <div className="scene-picker-folder">capturas-tela</div>
              </div>
            </div>
            <div className="scene-dialog-actions">
              <span>Fechar</span>
              <span className="primary">Abrir pasta</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "03") {
    return (
      <div className="install-motion-scene scene-step-03" aria-hidden>
        <div className="scene-browser-topbar">
          <span />
          <span />
          <span />
        </div>
        <div className="scene-address-bar">chrome://extensions</div>
        <div className="scene-step-body">
          <div className="scene-toolbar">
            <div className="scene-toolbar-btn">Carregar sem compactacao</div>
            <div className="scene-toolbar-btn">Empacotar extensao</div>
            <div className="scene-toolbar-btn">Atualizar</div>
            <div className="scene-dev-toggle-wrap">
              <span>Modo do desenvolvedor</span>
              <span className="scene-dev-toggle" />
            </div>
          </div>
          <div className="scene-extension-grid">
            <div className="scene-extension-card" />
            <div className="scene-extension-card" />
            <div className="scene-extension-card" />
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "04") {
    return (
      <div className="install-motion-scene scene-step-04" aria-hidden>
        <div className="scene-browser-topbar">
          <span />
          <span />
          <span />
        </div>
        <div className="scene-address-bar">chrome://extensions</div>
        <div className="scene-step-body">
          <div className="scene-dropzone">Carregar sem compactacao</div>
          <div className="scene-confirm-dialog">
            <div className="scene-dialog-title">Selecionar pasta</div>
            <div className="scene-file-picker">
              <div className="scene-file-picker-sidebar">
                <span>Area de Trabalho</span>
                <span>Downloads</span>
                <span>Documentos</span>
              </div>
              <div className="scene-file-picker-main">
                <div className="scene-picker-path">Este Computador &gt; Downloads</div>
                <div className="scene-picker-folder is-target">
                  oddzone-extension
                </div>
                <div className="scene-picker-folder">capturas-tela</div>
                <div className="scene-picker-folder">projetos</div>
              </div>
            </div>
            <div className="scene-dialog-actions">
              <span>Cancelar</span>
              <span className="primary">Selecionar pasta</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function InstallationGuideModal({
  downloadPath
}: InstallationGuideModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const totalSteps = installSteps.length;
  const currentStep = installSteps[currentStepIndex];

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key === "ArrowRight") {
        setCurrentStepIndex((index) => Math.min(index + 1, totalSteps - 1));
      }

      if (event.key === "ArrowLeft") {
        setCurrentStepIndex((index) => Math.max(index - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, totalSteps]);

  const closeModal = () => setIsOpen(false);
  const openModal = () => {
    setCurrentStepIndex(0);
    setIsOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="install-guide-text-trigger"
        onClick={openModal}
      >
        Como instalar ?
      </button>

      {isOpen ? (
        <section
          className="install-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-modal-title"
        >
          <div className="install-modal-surface">
            <header className="install-modal-header">
              <div>
                <p className="install-modal-kicker">Guia visual</p>
                <h2 id="install-modal-title" className="install-modal-title">
                  Demonstracao da instalacao
                </h2>
              </div>
              <button
                type="button"
                className="install-modal-close"
                onClick={closeModal}
                aria-label="Fechar guia de instalacao"
              >
                Fechar
              </button>
            </header>

            <div className="install-modal-content">
              <div className="install-modal-media-wrap">
                <InstallMotionScene stepId={currentStep.id} />
              </div>

              <aside className="install-modal-side">
                <p className="install-step-id">{currentStep.id}</p>
                <h3 className="install-step-headline">{currentStep.title}</h3>
                <p className="install-step-action">{currentStep.summary}</p>

                <ol className="install-step-picker" aria-label="Selecionar etapa">
                  {installSteps.map((step, index) => {
                    const isActive = index === currentStepIndex;
                    return (
                      <li key={step.id}>
                        <button
                          type="button"
                          className={
                            isActive ? "install-step-chip is-active" : "install-step-chip"
                          }
                          onClick={() => setCurrentStepIndex(index)}
                          aria-current={isActive ? "step" : undefined}
                        >
                          <span>{step.id}</span>
                          <span>{step.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <div className="install-modal-actions">
                  <a
                    href={downloadPath}
                    download
                    className="install-nav-button install-nav-button-primary"
                  >
                    Baixar extensao
                  </a>
                </div>
              </aside>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
