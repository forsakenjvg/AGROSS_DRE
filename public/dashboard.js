// Dashboard DRE - AGROSS
class DREDashboard {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50;
        this.currentFilters = {};
        this.dreChart = null;
        this.deptoChart = null;
        this.loading = false;
        
        this.init();
    }

    async init() {
        console.log('🚀 [Dashboard] Inicializando dashboard...');
        this.bindEvents();
        this.applyInitialFilters();
        await this.loadInitialData();
        this.updateLastUpdateTime();
        this.startAutoRefresh();
        console.log('✅ [Dashboard] Dashboard inicializado com sucesso!');
    }

    bindEvents() {
        // Formulário de filtros
        document.getElementById('filterForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.applyFilters();
        });

        // Seletor de período pré-definido
        document.getElementById('periodoPredefinido').addEventListener('change', (e) => {
            this.aplicarPeriodoPredefinido(e.target.value);
        });

        // Botões
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });

        document.getElementById('exportCSVBtn').addEventListener('click', () => {
            this.exportCSV('detalhado');
        });

        document.getElementById('exportExcelBtn').addEventListener('click', () => {
            this.exportExcel('detalhado');
        });

        document.getElementById('exportCSVResumidoBtn').addEventListener('click', () => {
            this.exportCSV('resumido');
        });

        document.getElementById('exportExcelResumidoBtn').addEventListener('click', () => {
            this.exportExcel('resumido');
        });

        document.getElementById('cacheClearBtn').addEventListener('click', () => {
            this.clearCache();
        });

        // Set datas padrão
        this.setDefaultDates();
    }

    setDefaultDates() {
        // Define o período padrão como "Ano Atual"
        document.getElementById('periodoPredefinido').value = 'ano_atual';
        this.aplicarPeriodoPredefinido('ano_atual');
    }

    aplicarPeriodoPredefinido(periodo) {
        const hoje = new Date();
        let dataInicio = '';
        let dataFim = '';

        switch (periodo) {
            case 'mes_atual':
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                break;
            case 'mes_anterior':
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                break;
            case 'trimestre_atual':
                const mesAtual = hoje.getMonth();
                const trimestre = Math.floor(mesAtual / 3);
                const mesInicioTrimestre = trimestre * 3;
                dataInicio = new Date(hoje.getFullYear(), mesInicioTrimestre, 1);
                dataFim = new Date(hoje.getFullYear(), mesInicioTrimestre + 3, 0);
                break;
            case 'semestre_atual':
                const semestre = Math.floor(hoje.getMonth() / 6);
                dataInicio = new Date(hoje.getFullYear(), semestre * 6, 1);
                dataFim = new Date(hoje.getFullYear(), semestre * 6 + 6, 0);
                break;
            case 'ano_atual':
                dataInicio = new Date(hoje.getFullYear(), 0, 1);
                dataFim = new Date(hoje.getFullYear(), 11, 31);
                break;
            case 'ano_anterior':
                dataInicio = new Date(hoje.getFullYear() - 1, 0, 1);
                dataFim = new Date(hoje.getFullYear() - 1, 11, 31);
                break;
            case 'ultimos_30':
                dataInicio = new Date(hoje.getTime() - (30 * 24 * 60 * 60 * 1000));
                dataFim = hoje;
                break;
            case 'ultimos_90':
                dataInicio = new Date(hoje.getTime() - (90 * 24 * 60 * 60 * 1000));
                dataFim = hoje;
                break;
            case 'ultimo_ano':
                dataInicio = new Date(hoje.getTime() - (365 * 24 * 60 * 60 * 1000));
                dataFim = hoje;
                break;
            case 'custom':
                // Não altera as datas quando selecionado "Personalizado"
                return;
        }

        // Formata as datas para o input type="date"
        document.getElementById('dataInicio').value = dataInicio ? dataInicio.toISOString().split('T')[0] : '';
        document.getElementById('dataFim').value = dataFim ? dataFim.toISOString().split('T')[0] : '';

        console.log(`📅 [Filtros] Período definido: ${periodo}`, {
            inicio: document.getElementById('dataInicio').value,
            fim: document.getElementById('dataFim').value
        });
    }

    async loadInitialData() {
        try {
            await Promise.all([
                this.loadSummaryData(),
                this.loadDepartmentData(),
                this.loadDetailedData(),
                this.loadDRELines()
            ]);
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            this.showError('Falha ao carregar dados iniciais');
        }
    }

    async loadSummaryData() {
        try {
            console.log('🔄 [Summary] Iniciando carregamento...');
            this.showLoading();
            const queryString = this.buildQueryString();
            console.log('📊 [Summary] QueryString:', queryString);
            const startTime = performance.now();
            
            const response = await fetch('/api/dre/summary?' + queryString);
            const data = await response.json();
            
            const endTime = performance.now();
            console.log(`✅ [Summary] Dados carregados em ${(endTime - startTime).toFixed(2)}ms`, data);

            this.updateSummaryCards(data);
            this.updateDREChart(data);
            
        } catch (error) {
            console.error('❌ [Summary] Erro ao carregar:', error);
            throw error;
        }
    }

    async loadDepartmentData() {
        try {
            console.log('🔄 [Departments] Iniciando carregamento...');
            const queryString = this.buildQueryString();
            console.log('📊 [Departments] QueryString:', queryString);
            const startTime = performance.now();
            
            const response = await fetch('/api/dre/departamentos?' + queryString);
            const data = await response.json();
            
            const endTime = performance.now();
            console.log(`✅ [Departments] Dados carregados em ${(endTime - startTime).toFixed(2)}ms`, data);

            this.updateDepartmentChart(data);
            this.updateDepartmentSelect(data);
            
        } catch (error) {
            console.error('❌ [Departments] Erro ao carregar:', error);
            throw error;
        }
    }

    async loadDetailedData(page = 1) {
        try {
            console.log('🔄 [Detailed] Iniciando carregamento da página', page);
            this.currentPage = page;
            const queryString = this.buildQueryString();
            console.log('📊 [Detailed] QueryString:', queryString);
            const startTime = performance.now();
            
            const response = await fetch(`/api/dre?${queryString}&page=${page}&limit=${this.pageSize}`);
            const data = await response.json();
            
            const endTime = performance.now();
            console.log(`✅ [Detailed] Dados carregados em ${(endTime - startTime).toFixed(2)}ms - ${data.data?.length || 0} registros`, data.pagination);

            this.updateDetailedTable(data.data);
            this.updatePagination(data.pagination);
            
        } catch (error) {
            console.error('❌ [Detailed] Erro ao carregar dados detalhados:', error);
            throw error;
        }
    }

    async loadDRELines() {
        try {
            const response = await fetch('/api/dre/summary?' + this.buildQueryString());
            const data = await response.json();
            
            const uniqueLines = [...new Set(data.map(item => item.linha_dre))];
            const select = document.getElementById('linhaDRE');
            
            select.innerHTML = '<option value="">Todas</option>';
            uniqueLines.forEach(line => {
                const option = document.createElement('option');
                option.value = line;
                option.textContent = line;
                select.appendChild(option);
            });
            
        } catch (error) {
            console.error('Erro ao carregar linhas DRE:', error);
        }
    }

    updateSummaryCards(data) {
        const receitaOperacional = data.find(item => 
            item.linha_dre.includes('RECEITA OPERACIONAL LIQUIDA')
        )?.valor_total || 0;

        const despesasOperacionais = data.find(item => 
            item.linha_dre.includes('DESPESAS OPERACIONAIS')
        )?.valor_total || 0;

        const totalLancamentos = data.reduce((sum, item) => 
            sum + item.quantidade_lancamentos, 0
        );

        // CPV/CMV/CSP também é uma despesa operacional
        const cpvCmv = data.find(item => 
            item.linha_dre.includes('CPV/CMV/CSP')
        )?.valor_total || 0;

        // OUTRAS RECEITAS OPERACIONAIS
        const outrasReceitasOperacionais = data.find(item => 
            item.linha_dre.includes('OUTRAS RECEITAS OPERACIONAIS')
        )?.valor_total || 0;

        // OUTRAS DESPESAS OPERACIONAIS
        const outrasDespesasOperacionais = data.find(item => 
            item.linha_dre.includes('OUTRAS DESPESAS OPERACIONAIS')
        )?.valor_total || 0;

        // Cálculo correto do Resultado Operacional
        // Receita - CPV - Despesas Operacionais + Outras Receitas Operacionais - Outras Despesas Operacionais
        const resultadoOperacional = receitaOperacional + cpvCmv + despesasOperacionais + outrasReceitasOperacionais + outrasDespesasOperacionais;

        document.getElementById('receitaOperacional').textContent = 
            this.formatCurrency(receitaOperacional);
        document.getElementById('despesasOperacionais').textContent = 
            this.formatCurrency(Math.abs(despesasOperacionais + cpvCmv + outrasDespesasOperacionais));
        document.getElementById('resultadoOperacional').textContent = 
            this.formatCurrency(resultadoOperacional);
        document.getElementById('totalLancamentos').textContent = 
            totalLancamentos.toLocaleString('pt-BR');

        // Aplicar cores baseadas nos valores
        const resultadoElement = document.getElementById('resultadoOperacional');
        resultadoElement.className = resultadoOperacional >= 0 ? 'mb-0 text-white' : 'mb-0 text-white';
    }

    updateDREChart(data) {
        const ctx = document.getElementById('dreChart').getContext('2d');
        
        if (this.dreChart) {
            this.dreChart.destroy();
        }

        const labels = data.map(item => item.linha_dre.split(') ')[1] || item.linha_dre);
        const valores = data.map(item => item.valor_total);
        const cores = valores.map(valor => valor >= 0 ? 'rgba(25, 135, 84, 0.8)' : 'rgba(220, 53, 69, 0.8)');

        this.dreChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Valor (R$)',
                    data: valores,
                    backgroundColor: cores,
                    borderColor: cores.map(cor => cor.replace('0.8', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return this.formatCurrency(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value, true)
                        }
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }

    updateDepartmentChart(data) {
        const ctx = document.getElementById('deptoChart').getContext('2d');
        
        if (this.deptoChart) {
            this.deptoChart.destroy();
        }

        // Pegar top 10 departamentos
        const topData = data.slice(0, 10);
        
        this.deptoChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: topData.map(item => item.departamento),
                datasets: [{
                    data: topData.map(item => Math.abs(item.valor_total)),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${this.formatCurrency(context.parsed)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    updateDepartmentSelect(data) {
        const select = document.getElementById('departamento');
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">Todos</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.departamento;
            option.textContent = item.departamento;
            select.appendChild(option);
        });
        
        select.value = currentValue;
    }

    updateDetailedTable(data) {
        const tbody = document.getElementById('dataTable');
        
        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        <i class="fas fa-inbox fa-2x mb-2"></i>
                        <div>Nenhum registro encontrado</div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = data.map(item => `
            <tr class="fade-in">
                <td>${this.formatDate(item.data)}</td>
                <td><small>${item.linha_dre}</small></td>
                <td><span class="badge bg-secondary">${item.departamento}</span></td>
                <td><small>${item.conta_contabil}</small></td>
                <td class="${item.vl_rateado >= 0 ? 'valor-positive' : 'valor-negative'}">
                    ${this.formatCurrency(item.vl_rateado)}
                </td>
                <td><span class="badge bg-${item.tipo === 'DÉBITO' ? 'danger' : 'primary'}">${item.tipo}</span></td>
                <td><small class="text-muted">${item.historico_contabil || '-'}</small></td>
            </tr>
        `).join('');

        document.getElementById('recordCount').textContent = 
            `${data.length} registros`;
    }

    updatePagination(pagination) {
        const paginationEl = document.getElementById('pagination');
        
        if (pagination.totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';
        
        // Previous
        html += `
            <li class="page-item ${pagination.page <= 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="dashboard.loadDetailedData(${pagination.page - 1})">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;

        // Page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.totalPages, pagination.page + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === pagination.page ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="dashboard.loadDetailedData(${i})">${i}</a>
                </li>
            `;
        }

        // Next
        html += `
            <li class="page-item ${pagination.page >= pagination.totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="dashboard.loadDetailedData(${pagination.page + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;

        paginationEl.innerHTML = html;
    }

    applyInitialFilters() {
        // Aplica os filtros padrão ao inicializar
        this.currentFilters = {
            dataInicio: document.getElementById('dataInicio').value,
            dataFim: document.getElementById('dataFim').value,
            departamento: document.getElementById('departamento').value,
            linhaDRE: document.getElementById('linhaDRE').value
        };
        
        console.log('🎯 [Filtros] Filtros iniciais aplicados:', this.currentFilters);
    }

    applyFilters() {
        this.currentFilters = {
            dataInicio: document.getElementById('dataInicio').value,
            dataFim: document.getElementById('dataFim').value,
            departamento: document.getElementById('departamento').value,
            linhaDRE: document.getElementById('linhaDRE').value
        };

        console.log('🎯 [Filtros] Novos filtros aplicados:', this.currentFilters);
        this.currentPage = 1;
        this.loadInitialData();
    }

    clearFilters() {
        console.log('🧹 [Filtros] Limpando filtros...');
        document.getElementById('filterForm').reset();
        this.setDefaultDates();
        this.applyInitialFilters();
        this.currentPage = 1;
        this.loadInitialData();
    }

    buildQueryString() {
        const params = new URLSearchParams();
        
        Object.entries(this.currentFilters).forEach(([key, value]) => {
            if (value) params.append(key, value);
        });
        
        return params.toString();
    }

    async refreshData() {
        if (this.loading) return;
        
        try {
            this.loading = true;
            const btn = document.getElementById('refreshBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Atualizando...';

            await this.loadInitialData();
            this.updateLastUpdateTime();
            this.showSuccess('Dados atualizados com sucesso!');
            
        } catch (error) {
            this.showError('Falha ao atualizar dados');
        } finally {
            this.loading = false;
            const btn = document.getElementById('refreshBtn');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
        }
    }

    async clearCache() {
        try {
            const response = await fetch('/api/cache/clear', { method: 'POST' });
            if (response.ok) {
                this.showSuccess('Cache limpo com sucesso!');
                await this.refreshData();
            }
        } catch (error) {
            this.showError('Falha ao limpar cache');
        }
    }

    async exportCSV(type = 'detalhado') {
        try {
            this.showLoading();
            const btn = document.getElementById('exportCSVBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exportando...';

            const queryString = this.buildQueryString();
            const url = `/api/export/csv?${queryString}&type=${type}`;
            
            console.log(`📊 [Export] Iniciando exportação CSV ${type}...`);
            const startTime = performance.now();

            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro na exportação');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `dre_export_${type}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            const endTime = performance.now();
            console.log(`✅ [Export] CSV exportado em ${(endTime - startTime).toFixed(2)}ms`);

            this.showSuccess(`Dados exportados como CSV ${type} com sucesso!`);

        } catch (error) {
            console.error('❌ [Export] Erro na exportação CSV:', error);
            this.showError(`Falha na exportação CSV: ${error.message}`);
        } finally {
            const btn = document.getElementById('exportCSVBtn');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-csv me-2"></i>Exportar CSV';
        }
    }

    async exportExcel(type = 'detalhado') {
        try {
            this.showLoading();
            const btn = document.getElementById('exportExcelBtn');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Exportando...';

            const queryString = this.buildQueryString();
            const url = `/api/export/excel?${queryString}&type=${type}`;
            
            console.log(`📊 [Export] Iniciando exportação Excel ${type}...`);
            const startTime = performance.now();

            const response = await fetch(url);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro na exportação');
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || `dre_export_${type}_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            const endTime = performance.now();
            console.log(`✅ [Export] Excel exportado em ${(endTime - startTime).toFixed(2)}ms`);

            this.showSuccess(`Dados exportados como Excel ${type} com sucesso!`);

        } catch (error) {
            console.error('❌ [Export] Erro na exportação Excel:', error);
            this.showError(`Falha na exportação Excel: ${error.message}`);
        } finally {
            const btn = document.getElementById('exportExcelBtn');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-excel me-2"></i>Exportar Excel';
        }
    }

    updateLastUpdateTime() {
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            `Última atualização: ${now.toLocaleTimeString('pt-BR')}`;
    }

    startAutoRefresh() {
        // Auto-refresh a cada 5 minutos
        setInterval(() => {
            this.refreshData();
        }, 5 * 60 * 1000);
    }

    showLoading() {
        // Mostrar loading states nos cards
        document.querySelectorAll('.card-body h3').forEach(el => {
            el.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Carregando...';
        });
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'danger');
    }

    showToast(message, type = 'info') {
        const toastHtml = `
            <div class="toast align-items-center text-white bg-${type} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }

        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement);
        toast.show();

        // Remover toast após esconder
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    // Utility functions
    formatCurrency(value, short = false) {
        const num = Math.abs(value);
        if (short && num >= 1000000) {
            return `R$ ${(num / 1000000).toFixed(1)}M`;
        }
        return `R$ ${num.toLocaleString('pt-BR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        })}`;
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }
}

// Inicializar dashboard quando DOM estiver pronto
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DREDashboard();
});

// Expor para uso global (para os links de paginação)
window.dashboard = dashboard;
