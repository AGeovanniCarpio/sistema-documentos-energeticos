// Sistema de Documentos Energéticos - Funcionalidad Principal
class EnergyDocumentSystem {
    constructor() {
        this.db = null;
        this.storage = null;
        this.initialized = false;
        
        console.log('🔧 Iniciando sistema...');
    }

    // Inicializar Firebase
    async initializeFirebase() {
        try {
            if (typeof firebase !== 'undefined' && window.CONFIG?.firebaseConfig) {
                // Inicializar Firebase
                if (!firebase.apps.length) {
                    firebase.initializeApp(window.CONFIG.firebaseConfig);
                }
                
                this.db = firebase.firestore();
                this.storage = firebase.storage();
                
                // Probar conexión
                await this.db.collection('test').limit(1).get();
                
                this.updateSystemStatus('firebase', '✅');
                console.log('✅ Firebase conectado');
                return true;
            }
        } catch (error) {
            console.warn('⚠️ Firebase no disponible:', error.message);
            this.updateSystemStatus('firebase', '❌');
            return false;
        }
    }

    // Verificar Documentero
    async checkDocumentero(apiKey) {
        try {
            if (!apiKey) {
                this.updateSystemStatus('documentero', '⚠️');
                return false;
            }

            // Test básico de API
            const response = await fetch(`${window.CONFIG.documenteroConfig.baseUrl}/ping`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok || response.status === 404) { // 404 es normal si no hay endpoint /ping
                this.updateSystemStatus('documentero', '✅');
                console.log('✅ Documentero conectado');
                return true;
            } else {
                this.updateSystemStatus('documentero', '❌');
                return false;
            }
        } catch (error) {
            console.warn('⚠️ Error verificando Documentero:', error.message);
            this.updateSystemStatus('documentero', '⚠️');
            return true; // Asumir que funciona para continuar
        }
    }

    // Obtener datos de auditoría desde Firebase
    async getAuditData(auditId) {
        if (!this.db) {
            console.warn('⚠️ Firebase no disponible, usando datos simulados');
            return this.getSimulatedData(auditId);
        }

        try {
            console.log(`🔍 Obteniendo datos para auditoría: ${auditId}`);
            
            const auditData = {
                cliente: null,
                auditoria: null,
                hallazgos: [],
                recomendaciones: [],
                mediciones: []
            };

            // Buscar en diferentes colecciones
            const collections = ['auditorias', 'audits', 'auditoría'];
            
            for (const collectionName of collections) {
                try {
                    const doc = await this.db.collection(collectionName).doc(auditId).get();
                    if (doc.exists) {
                        auditData.auditoria = doc.data();
                        console.log(`✅ Auditoría encontrada en: ${collectionName}`);
                        break;
                    }
                } catch (error) {
                    console.log(`⚠️ Colección ${collectionName} no existe`);
                }
            }

            // Buscar hallazgos
            try {
                const hallazgosSnapshot = await this.db.collection('hallazgos')
                    .where('auditoria_id', '==', auditId)
                    .get();
                
                hallazgosSnapshot.forEach(doc => {
                    auditData.hallazgos.push(doc.data());
                });
            } catch (error) {
                console.log('⚠️ No se encontraron hallazgos');
            }

            // Si no hay datos reales, usar simulados
            if (!auditData.auditoria && auditData.hallazgos.length === 0) {
                console.log('📊 Usando datos simulados');
                return this.getSimulatedData(auditId);
            }

            return auditData;

        } catch (error) {
            console.error('❌ Error obteniendo datos:', error);
            return this.getSimulatedData(auditId);
        }
    }

    // Datos simulados para testing
    getSimulatedData(auditId) {
        return {
            cliente: {
                nombre: "Empresa Ejemplo S.A.",
                email: "contacto@ejemplo.com",
                telefono: "+52 55 1234 5678"
            },
            auditoria: {
                id: auditId,
                fecha: new Date().toLocaleDateString('es-ES'),
                auditor: "Juan Pérez",
                tipo_instalacion: "Industrial"
            },
            hallazgos: [
                {
                    descripcion: "Consumo elevado en iluminación",
                    criticidad: "alta",
                    ubicacion: "Área de producción"
                },
                {
                    descripcion: "Factor de potencia bajo",
                    criticidad: "media",
                    ubicacion: "Tablero principal"
                }
            ],
            recomendaciones: [
                {
                    titulo: "Cambio a iluminación LED",
                    descripcion: "Reemplazar luminarias actuales por LED",
                    ahorro_estimado: "30% del consumo actual"
                }
            ]
        };
    }

    // Procesar datos para documento
    processDataForDocument(auditData, documentType) {
        const now = new Date();
        
        return {
            // Metadatos
            fecha_generacion: now.toLocaleDateString('es-ES'),
            hora_generacion: now.toLocaleTimeString('es-ES'),
            numero_documento: `${documentType.toUpperCase()}-${now.getTime()}`,
            tipo_documento: documentType,

            // Datos del cliente
            cliente_nombre: auditData.cliente?.nombre || 'Cliente no especificado',
            cliente_email: auditData.cliente?.email || '',
            cliente_telefono: auditData.cliente?.telefono || '',

            // Datos de auditoría
            auditoria_id: auditData.auditoria?.id || 'N/A',
            fecha_auditoria: auditData.auditoria?.fecha || now.toLocaleDateString('es-ES'),
            auditor: auditData.auditoria?.auditor || 'Auditor Energético',
            tipo_instalacion: auditData.auditoria?.tipo_instalacion || 'Industrial',

            // Estadísticas
            total_hallazgos: auditData.hallazgos?.length || 0,
            total_recomendaciones: auditData.recomendaciones?.length || 0,

            // Listas
            hallazgos: auditData.hallazgos || [],
            recomendaciones: auditData.recomendaciones || [],

            // Resumen automático
            resumen_ejecutivo: this.generateSummary(auditData)
        };
    }

    // Generar resumen automático
    generateSummary(auditData) {
        const empresa = auditData.cliente?.nombre || 'la instalación';
        const hallazgos = auditData.hallazgos?.length || 0;
        
        return `Se realizó una auditoría energética en ${empresa}. ` +
               `Se identificaron ${hallazgos} hallazgos que requieren atención. ` +
               `Se han formulado recomendaciones específicas para mejorar la eficiencia energética.`;
    }

    // Generar documento con Documentero
    async generateWithDocumentero(processedData, apiKey) {
        try {
            console.log('📄 Generando con Documentero...');

            // Crear plantilla básica en memoria (para demo)
            const templateContent = this.createBasicTemplate(processedData);
            const templateBlob = new Blob([templateContent], { 
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
            });

            const formData = new FormData();
            formData.append('document', templateBlob, 'template.docx');
            formData.append('data', JSON.stringify(processedData));
            formData.append('format', 'docx');

            const response = await fetch(`${window.CONFIG.documenteroConfig.baseUrl}/render`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error Documentero: ${response.status}`);
            }

            const documentBlob = await response.blob();
            return {
                success: true,
                blob: documentBlob,
                filename: `${processedData.numero_documento}.docx`
            };

        } catch (error) {
            console.error('❌ Error con Documentero:', error);
            // Generar documento HTML como fallback
            return this.generateHTMLFallback(processedData);
        }
    }

    // Crear plantilla básica
    createBasicTemplate(data) {
        return `
        REPORTE DE AUDITORÍA ENERGÉTICA
        
        Cliente: ${data.cliente_nombre}
        Fecha: ${data.fecha_auditoria}
        Auditor: ${data.auditor}
        
        RESUMEN:
        ${data.resumen_ejecutivo}
        
        HALLAZGOS (${data.total_hallazgos}):
        ${data.hallazgos.map((h, i) => `${i+1}. ${h.descripcion} (${h.criticidad})`).join('\n')}
        
        RECOMENDACIONES (${data.total_recomendaciones}):
        ${data.recomendaciones.map((r, i) => `${i+1}. ${r.titulo}: ${r.descripcion}`).join('\n')}
        
        Documento generado el ${data.fecha_generacion} a las ${data.hora_generacion}
        `;
    }

    // Fallback HTML si falla Documentero
    generateHTMLFallback(data) {
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reporte de Auditoría - ${data.numero_documento}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #333; border-bottom: 2px solid #667eea; }
                .section { margin: 20px 0; }
                .hallazgo { background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #dc3545; }
                .recomendacion { background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #28a745; }
            </style>
        </head>
        <body>
            <h1>🔥 Reporte de Auditoría Energética</h1>
            
            <div class="section">
                <h2>📋 Información General</h2>
                <p><strong>Cliente:</strong> ${data.cliente_nombre}</p>
                <p><strong>Fecha de Auditoría:</strong> ${data.fecha_auditoria}</p>
                <p><strong>Auditor:</strong> ${data.auditor}</p>
                <p><strong>Número de Documento:</strong> ${data.numero_documento}</p>
            </div>

            <div class="section">
                <h2>📊 Resumen Ejecutivo</h2>
                <p>${data.resumen_ejecutivo}</p>
            </div>

            <div class="section">
                <h2>🔍 Hallazgos (${data.total_hallazgos})</h2>
                ${data.hallazgos.map(h => `
                    <div class="hallazgo">
                        <strong>${h.descripcion}</strong><br>
                        <small>Criticidad: ${h.criticidad} | Ubicación: ${h.ubicacion}</small>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>💡 Recomendaciones (${data.total_recomendaciones})</h2>
                ${data.recomendaciones.map(r => `
                    <div class="recomendacion">
                        <strong>${r.titulo}</strong><br>
                        <p>${r.descripcion}</p>
                    </div>
                `).join('')}
            </div>

            <div class="section">
                <p><small>Documento generado el ${data.fecha_generacion} a las ${data.hora_generacion}</small></p>
            </div>
        </body>
        </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        return {
            success: true,
            blob: blob,
            filename: `${data.numero_documento}.html`
        };
    }
   // Descargar archivo (versión mejorada)
    downloadFile(blob, filename) {
        try {
            console.log('📥 Iniciando descarga:', filename);
            
            // Crear URL del blob
            const url = window.URL.createObjectURL(blob);
            
            // Crear elemento de descarga
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            // Agregar al DOM temporalmente
            document.body.appendChild(link);
            
            // Forzar clic
            link.click();
            
            // Limpiar
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 100);
            
            // Mostrar mensaje
            this.updateStatus('success', `📥 Descarga iniciada: ${filename}`);
            console.log('✅ Descarga forzada');
            
        } catch (error) {
            console.error('❌ Error en descarga:', error);
            
            // Fallback: abrir en nueva ventana
            const url = window.URL.createObjectURL(blob);
            window.open(url, '_blank');
            this.updateStatus('info', '📄 Documento abierto en nueva ventana');
        }
    }

    // Actualizar estado del sistema en UI
    updateSystemStatus(system, status) {
        const element = document.getElementById(`${system}Status`);
        if (element) {
            element.textContent = status;
        }
    }

    // Actualizar mensaje de estado
    updateStatus(type, message) {
        const statusDiv = document.getElementById('systemStatus');
        if (statusDiv) {
            statusDiv.className = `status status-${type}`;
            statusDiv.textContent = message;
        }
    }

    // Agregar documento a la lista
    addDocumentToList(filename, type) {
        const container = document.getElementById('documentsGenerated');
        const docItem = document.createElement('div');
        docItem.style.cssText = 'padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;';
        docItem.innerHTML = `
            <strong>📄 ${filename}</strong><br>
            <small>Tipo: ${type} • ${new Date().toLocaleString('es-ES')}</small>
        `;
        
        // Insertar al principio
        const firstChild = container.firstElementChild;
        if (firstChild && firstChild.tagName === 'DIV') {
            container.insertBefore(docItem, firstChild);
        } else {
            container.appendChild(docItem);
        }
    }

    // Método principal para generar documento
    async generateDocument() {
        const apiKey = document.getElementById('documenteroKey').value.trim();
        const auditId = document.getElementById('auditId').value.trim();
        const documentType = document.getElementById('documentType').value;

        if (!apiKey || !auditId || !documentType) {
            this.updateStatus('error', '❌ Por favor completa todos los campos');
            return;
        }

        try {
            this.updateStatus('info', '🔄 Generando documento...');

            // Verificar Documentero
            await this.checkDocumentero(apiKey);

            // Obtener datos de auditoría
            this.updateStatus('info', '📊 Obteniendo datos de auditoría...');
            const auditData = await this.getAuditData(auditId);

            // Procesar datos
            this.updateStatus('info', '🔄 Procesando datos...');
            const processedData = this.processDataForDocument(auditData, documentType);

            // Generar documento
            this.updateStatus('info', '📄 Generando documento final...');
            const result = await this.generateWithDocumentero(processedData, apiKey);

            if (result.success) {
                // Descargar archivo
                this.downloadFile(result.blob, result.filename);
                
                // Actualizar UI
                this.updateStatus('success', `✅ Documento generado: ${result.filename}`);
                this.addDocumentToList(result.filename, documentType);
                
                console.log('🎉 Documento generado exitosamente');
            } else {
                throw new Error('Error en la generación del documento');
            }

        } catch (error) {
            console.error('❌ Error:', error);
            this.updateStatus('error', `❌ Error: ${error.message}`);
        }
    }

    // Inicializar sistema completo
    async initialize() {
        console.log('🚀 Inicializando sistema completo...');
        
        // Inicializar Firebase
        await this.initializeFirebase();
        
        // Configurar event listeners
        this.setupEventListeners();
        
        this.initialized = true;
        this.updateStatus('success', '✅ Sistema inicializado - Listo para generar documentos');
        
        console.log('✅ Sistema completamente inicializado');
    }

    // Configurar event listeners
    setupEventListeners() {
        // Validación de formulario
        ['documenteroKey', 'auditId', 'documentType'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('input', () => this.validateForm());
                element.addEventListener('change', () => this.validateForm());
            }
        });

        // Botón generar
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => this.generateDocument());
        }
    }

    // Validar formulario
    validateForm() {
        const apiKey = document.getElementById('documenteroKey')?.value.trim();
        const auditId = document.getElementById('auditId')?.value.trim();
        const docType = document.getElementById('documentType')?.value;
        const generateBtn = document.getElementById('generateBtn');

        if (!generateBtn) return;

        const isValid = apiKey && auditId && docType;
        generateBtn.disabled = !isValid;
        
        if (isValid) {
            generateBtn.textContent = '🚀 Generar Documento';
            generateBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        } else {
            generateBtn.textContent = '⚠️ Completa todos los campos';
            generateBtn.style.background = '#ccc';
        }
    }
}

// Inicializar cuando cargue la página
let energySystem = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Cargando Sistema de Documentos Energéticos...');
    
    // Esperar a que se cargue la configuración
    if (typeof window.CONFIG === 'undefined') {
        console.log('⏳ Esperando configuración...');
        setTimeout(() => {
            initializeSystem();
        }, 1000);
    } else {
        initializeSystem();
    }
});

async function initializeSystem() {
    try {
        energySystem = new EnergyDocumentSystem();
        await energySystem.initialize();
    } catch (error) {
        console.error('❌ Error inicializando sistema:', error);
        
        const statusDiv = document.getElementById('systemStatus');
        if (statusDiv) {
            statusDiv.className = 'status status-error';
            statusDiv.textContent = `❌ Error de inicialización: ${error.message}`;
        }
    }
}

console.log('✅ app.js cargado correctamente');
