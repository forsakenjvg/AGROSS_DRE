// Dashboard DRE - AGROSS
class DREDashboard {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50;
        this.currentFilters = {};
        this.deptoChart = null;
        this.monthlyChart = null;
        this.loading = false;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.currentTableData = [];
        
        this.init();
    }

    async init() {
        console.log('🚀 [Dashboard] Inicializando dashboard...');
        this.bindEvents();
        this.applyInitialFilters();
        // Removido carregamento automático - dados serão carregados apenas ao aplicar filtros
        this.initializeEmptyState();
        this.updateLastUpdateTime();
        // Removido auto-refresh para não carregar dados automaticamente
        
        // Adicionar listener para redimensionamento da janela
        this.setupResizeHandler();
        
        console.log('✅ [Dashboard] Dashboard inicializado com sucesso!');
    }

    bindEvents() {
        // Busca avançada
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const clearSearchBtn = document.getElementById('clearSearch');
        const saveSearchBtn = document.getElementById('saveSearchBtn');

        // Evento de busca (Enter no input ou clique no botão)
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });

            // Mostrar/ocultar sugestões ao focar no input
            searchInput.addEventListener('focus', () => {
                this.showSearchSuggestions();
            });

            searchInput.addEventListener('blur', () => {
                // Delay para permitir clique nas sugestões
                setTimeout(() => {
                    this.hideSearchSuggestions();
                }, 200);
            });

            // Auto-complete (debounce)
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    if (e.target.value.length >= 2) {
                        this.showSearchSuggestions(e.target.value);
                    } else {
                        this.hideSearchSuggestions();
                    }
                }, 300);
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }

        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        if (saveSearchBtn) {
            saveSearchBtn.addEventListener('click', () => {
                this.saveCurrentSearch();
            });
        }

        // Quick filters
        document.querySelectorAll('.quick-filter').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.applyQuickFilter(filter);
            });
        });

        // Search suggestions
        document.querySelectorAll('.search-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                const searchValue = suggestion.dataset.search;
                document.getElementById('searchInput').value = searchValue;
                this.performSearch();
            });
        });

        // Toggle filters
        const toggleFiltersBtn = document.getElementById('toggleFilters');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', () => {
                this.toggleFiltersPanel();
            });
        }

        // Formulário de filtros
        document.getElementById('filterForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.applyFilters();
        });

        // Seletores de períodos (cards e botões)
        // Event delegation para cards
        document.addEventListener('click', (e) => {
            if (e.target.closest('.periodo-card')) {
                const card = e.target.closest('.periodo-card');
                const periodo = card.dataset.periodo;
                this.selecionarPeriodo(periodo);
                this.aplicarPeriodoPredefinido(periodo);
            }
            if (e.target.closest('.periodo-btn')) {
                const btn = e.target.closest('.periodo-btn');
                const periodo = btn.dataset.periodo;
                this.selecionarPeriodo(periodo);
                this.aplicarPeriodoPredefinido(periodo);
            }
        });

        // Seletor antigo (mantido por compatibilidade)
        const periodoSelect = document.getElementById('periodoPredefinido');
        if (periodoSelect) {
            periodoSelect.addEventListener('change', (e) => {
                this.aplicarPeriodoPredefinido(e.target.value);
            });
        }

        // Ordenação da tabela
        document.addEventListener('click', (e) => {
            if (e.target.closest('th.sortable')) {
                const th = e.target.closest('th.sortable');
                const column = th.dataset.column;
                this.ordenarTabela(column);
            }
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
        this.selecionarPeriodo('ano_atual');
        this.aplicarPeriodoPredefinido('ano_atual');
    }

    selecionarPeriodo(periodo) {
        // Remove todas as classes active dos cards e botões
        document.querySelectorAll('.periodo-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelectorAll('.periodo-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Adiciona a classe active ao elemento selecionado
        const selectedCard = document.querySelector(`.periodo-card[data-periodo="${periodo}"]`);
        const selectedBtn = document.querySelector(`.periodo-btn[data-periodo="${periodo}"]`);
        
        if (selectedCard) {
            selectedCard.classList.add('active');
        }
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }
        
        // Se for período custom, limpa as seleções
        if (periodo === 'custom') {
            // Deixa os elementos sem active quando for custom
        }
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
                this.loadDRELines(),
                this.loadMonthlyData()
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
            // Gráfico DRE removido - this.updateDREChart(data);
            
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

    async loadMonthlyData() {
        try {
            console.log('🔄 [Monthly] Iniciando carregamento...');
            const queryString = this.buildQueryString();
            console.log('📊 [Monthly] QueryString:', queryString);
            const startTime = performance.now();
            
            const response = await fetch('/api/dre/mensal?' + queryString);
            const data = await response.json();
            
            const endTime = performance.now();
            console.log(`✅ [Monthly] Dados carregados em ${(endTime - startTime).toFixed(2)}ms`, data);

            this.updateMonthlyChart(data);
            
        } catch (error) {
            console.error('❌ [Monthly] Erro ao carregar:', error);
            throw error;
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
        // Receita + CPV (já negativo) + Despesas (já negativas) + Outras Receitas + Outras Despesas (já negativas)
        const resultadoOperacional = receitaOperacional + cpvCmv + despesasOperacionais + outrasReceitasOperacionais + outrasDespesasOperacionais;

        // Atualizar todos os cards
        document.getElementById('receitaOperacional').textContent = 
            this.formatCurrency(receitaOperacional);
        document.getElementById('cpvCmv').textContent = 
            this.formatCurrency(cpvCmv); // Já será negativo se for despesa
        document.getElementById('despesasOperacionais').textContent = 
            this.formatCurrency(despesasOperacionais + outrasDespesasOperacionais); // Já será negativo
        document.getElementById('resultadoOperacional').textContent = 
            this.formatCurrency(resultadoOperacional);
        document.getElementById('totalLancamentos').textContent = 
            totalLancamentos.toLocaleString('pt-BR');

        // Aplicar cores baseadas nos valores
        const resultadoElement = document.getElementById('resultadoOperacional');
        resultadoElement.className = resultadoOperacional >= 0 ? 'mb-0 text-white' : 'mb-0 text-white';
    }

    // updateDREChart removido - gráfico "DRE por Linha" excluído conforme solicitado

    updateDepartmentChart(data) {
        const ctx = document.getElementById('deptoChart').getContext('2d');
        
        if (this.deptoChart) {
            this.deptoChart.destroy();
        }

        // Pegar top 10 departamentos
        const topData = data.slice(0, 10);
        
        // Determinar configurações responsivas
        const isMobile = window.innerWidth < 576;
        const isTablet = window.innerWidth >= 576 && window.innerWidth < 768;
        
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
                aspectRatio: isMobile ? 1 : isTablet ? 1.5 : 2,
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'right',
                        labels: {
                            padding: isMobile ? 5 : 10,
                            font: {
                                size: isMobile ? 9 : 11
                            },
                            boxWidth: isMobile ? 10 : 15,
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    const dataset = data.datasets[0];
                                    const total = dataset.data.reduce((a, b) => a + b, 0);
                                    return data.labels.map((label, i) => {
                                        const value = dataset.data[i];
                                        const percentage = ((value / total) * 100).toFixed(1);
                                        return {
                                            text: isMobile ? `${percentage}%` : `${label}: ${percentage}%`,
                                            fillStyle: dataset.backgroundColor[i],
                                            hidden: false,
                                            index: i
                                        };
                                    });
                                }
                                return [];
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
                },
                layout: {
                    padding: isMobile ? 5 : 10
                }
            }
        });
    }

    updateMonthlyChart(data) {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        
        if (this.monthlyChart) {
            this.monthlyChart.destroy();
        }

        // Determinar configurações responsivas
        const isMobile = window.innerWidth < 576;
        const isTablet = window.innerWidth >= 576 && window.innerWidth < 768;

        // Formatar labels dos meses (de 2024-01 para Jan/2024)
        const formattedLabels = data.labels.map(mes => {
            const [ano, mesNum] = mes.split('-');
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return isMobile ? `${meses[parseInt(mesNum) - 1]}` : `${meses[parseInt(mesNum) - 1]}/${ano}`;
        });

        // Ajustar cores e tamanhos para responsividade
        const adjustedDatasets = data.datasets.map(dataset => {
            let borderWidth = isMobile ? 1.5 : 2;
            let pointRadius = isMobile ? 2 : 3;
            let pointHoverRadius = isMobile ? 3 : 5;
            
            // Destacar categorias principais
            if (dataset.label.includes('Receita Operacional')) {
                borderWidth = isMobile ? 2 : 3;
                pointRadius = isMobile ? 3 : 4;
                pointHoverRadius = isMobile ? 4 : 6;
            } else if (dataset.label.includes('CPV/CMV/CSP') || dataset.label.includes('Despesas Operacionais')) {
                borderWidth = isMobile ? 1.8 : 2.5;
                pointRadius = isMobile ? 2.5 : 3.5;
                pointHoverRadius = isMobile ? 3.5 : 5.5;
            }

            return {
                ...dataset,
                borderWidth: borderWidth,
                pointRadius: pointRadius,
                pointHoverRadius: pointHoverRadius,
                fill: false,
                tension: 0.2
            };
        });

        this.monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: adjustedDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: isMobile ? 1.5 : isTablet ? 2 : 3,
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'top',
                        labels: {
                            padding: isMobile ? 8 : 15,
                            font: {
                                size: isMobile ? 9 : 11
                            },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            // Em mobile, truncar labels longos
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.datasets.map((dataset, i) => {
                                        let label = dataset.label || '';
                                        if (isMobile && label.length > 20) {
                                            label = label.substring(0, 17) + '...';
                                        }
                                        return {
                                            text: label,
                                            fillStyle: dataset.borderColor,
                                            strokeStyle: dataset.borderColor,
                                            lineWidth: dataset.borderWidth,
                                            hidden: dataset.hidden,
                                            index: i,
                                            pointStyle: 'circle'
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#ddd',
                        borderWidth: 1,
                        titleFont: {
                            size: isMobile ? 11 : 13
                        },
                        bodyFont: {
                            size: isMobile ? 10 : 12
                        },
                        callbacks: {
                            label: (context) => {
                                const value = this.formatCurrency(context.parsed.y);
                                const datasetLabel = context.dataset.label;
                                const label = isMobile && datasetLabel.length > 15 
                                    ? datasetLabel.substring(0, 12) + '...' 
                                    : datasetLabel;
                                return `${label}: ${value}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: !isMobile,
                            text: 'Mês',
                            font: {
                                size: isMobile ? 10 : 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 9 : 11
                            },
                            maxRotation: isMobile ? 45 : 0,
                            minRotation: isMobile ? 45 : 0
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: !isMobile,
                            text: 'Valor (R$)',
                            font: {
                                size: isMobile ? 10 : 12,
                                weight: 'bold'
                            }
                        },
                        ticks: {
                            callback: (value) => this.formatCurrency(value, true),
                            font: {
                                size: isMobile ? 9 : 10
                            },
                            maxTicksLimit: isMobile ? 5 : 8
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                elements: {
                    line: {
                        borderJoinStyle: 'round'
                    }
                },
                layout: {
                    padding: isMobile ? 
                        { top: 5, right: 5, bottom: 5, left: 5 } : 
                        { top: 10, right: 10, bottom: 10, left: 10 }
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
        // Armazenar todos os dados para ordenação
        this.currentTableData = data || [];
        
        // Aplicar ordenação atual se houver
        if (this.sortColumn) {
            this.ordenarTabela(this.sortColumn);
        } else {
            this.displayTableData();
        }
        
        document.getElementById('recordCount').textContent = 
            `${this.currentTableData.length} registros`;
    }

    updatePagination(totalRecords) {
        const paginationEl = document.getElementById('pagination');
        const totalPages = Math.ceil(totalRecords / this.pageSize);
        
        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            return;
        }

        let html = '';
        
        // Previous
        html += `
            <li class="page-item ${this.currentPage <= 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="dashboard.goToPage(${this.currentPage - 1})">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `
                <li class="page-item ${i === this.currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="dashboard.goToPage(${i})">${i}</a>
                </li>
            `;
        }

        // Next
        html += `
            <li class="page-item ${this.currentPage >= totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" onclick="dashboard.goToPage(${this.currentPage + 1})">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;

        paginationEl.innerHTML = html;
    }

    goToPage(page) {
        if (page >= 1) {
            this.currentPage = page;
            this.displayTableData();
        }
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
        // Removido carregamento automático - dados serão carregados apenas ao aplicar filtros
        this.initializeEmptyState();
    }

    initializeEmptyState() {
        // Inicializa os cards com valores vazios
        document.getElementById('receitaOperacional').textContent = 'R$ 0,00';
        document.getElementById('cpvCmv').textContent = 'R$ 0,00';
        document.getElementById('despesasOperacionais').textContent = 'R$ 0,00';
        document.getElementById('resultadoOperacional').textContent = 'R$ 0,00';
        document.getElementById('totalLancamentos').textContent = '0';

        // Limpa gráficos
        const deptoCtx = document.getElementById('deptoChart').getContext('2d');
        if (this.deptoChart) {
            this.deptoChart.destroy();
        }
        this.deptoChart = new Chart(deptoCtx, {
            type: 'doughnut',
            data: {
                labels: ['Sem dados'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['#e9ecef']
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
                        enabled: false
                    }
                }
            }
        });

        const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
        if (this.monthlyChart) {
            this.monthlyChart.destroy();
        }
        this.monthlyChart = new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                }
            }
        });

        // Inicializa tabela vazia com mensagem informativa
        this.currentTableData = [];
        this.currentPage = 1;
        const tbody = document.getElementById('dataTable');
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    <i class="fas fa-filter fa-3x mb-3"></i>
                    <p>Selecione um período e clique em "Aplicar Filtros" para visualizar os dados.</p>
                </td>
            </tr>
        `;

        // Limpa select de departamento e linha DRE
        document.getElementById('departamento').innerHTML = '<option value="">Todos</option>';
        document.getElementById('linhaDRE').innerHTML = '<option value="">Todas</option>';

        console.log('📋 [Dashboard] Estado vazio inicializado');
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
        // Auto-refresh desativado - dados serão carregados apenas ao aplicar filtros
        console.log('🔄 [AutoRefresh] Desativado - dados carregados apenas sob demanda');
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
        const isNegative = value < 0;
        
        let formattedValue;
        if (short && num >= 1000000) {
            formattedValue = `R$ ${(num / 1000000).toFixed(1)}M`;
        } else {
            formattedValue = `R$ ${num.toLocaleString('pt-BR', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            })}`;
        }
        
        // Adicionar sinal de negativo se necessário
        return isNegative ? `- ${formattedValue}` : formattedValue;
    }

    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            // Debounce para evitar múltiplos redimensionamentos
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.deptoChart) {
                    this.deptoChart.resize();
                }
                if (this.monthlyChart) {
                    this.monthlyChart.resize();
                }
            }, 250);
        });

        // Listener para mudança de orientação (especial para mobile)
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                if (this.deptoChart) {
                    this.deptoChart.resize();
                }
                if (this.monthlyChart) {
                    this.monthlyChart.resize();
                }
            }, 500); // Aguardar a rotação completar
        });
    }

    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }
    ordenarTabela(column) {
        // Se clicar na mesma coluna, inverte a direção
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // Atualizar ícones
        this.updateSortIcons();

        // Reordenar dados
        this.currentTableData.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];

            // Tratar valores nulos ou indefinidos
            if (valueA == null) valueA = '';
            if (valueB == null) valueB = '';

            // Converter para comparação
            if (column === 'data') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            } else if (column === 'vl_rateado') {
                valueA = parseFloat(valueA) || 0;
                valueB = parseFloat(valueB) || 0;
            } else {
                valueA = String(valueA).toLowerCase();
                valueB = String(valueB).toLowerCase();
            }

            // Comparar
            if (valueA < valueB) {
                return this.sortDirection === 'asc' ? -1 : 1;
            }
            if (valueA > valueB) {
                return this.sortDirection === 'asc' ? 1 : -1;
            }
            return 0;
        });

        // Atualizar tabela
        this.displayTableData();
    }

    updateSortIcons() {
        // Limpar todos os ícones
        document.querySelectorAll('th.sortable i').forEach(icon => {
            icon.className = 'fas fa-sort';
        });

        // Atualizar ícone da coluna ativa
        if (this.sortColumn) {
            const activeTh = document.querySelector(`th[data-column="${this.sortColumn}"]`);
            if (activeTh) {
                const icon = activeTh.querySelector('i');
                if (icon) {
                    icon.className = this.sortDirection === 'asc' ? 'fas fa-sort-asc' : 'fas fa-sort-desc';
                }
            }
        }
    }

    displayTableData() {
        const tbody = document.getElementById('dataTable');
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        const pageData = this.currentTableData.slice(start, end);

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted">
                        <i class="fas fa-inbox fa-3x mb-3"></i>
                        <p>Nenhum registro encontrado para este período.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = pageData.map(row => `
            <tr class="table-row-hover" role="button" tabindex="0" data-row='${JSON.stringify(row).replace(/'/g, '&apos;')}'>
                <td>${this.formatDate(row.data)}</td>
                <td>${row.linha_dre || '-'}</td>
                <td>${row.departamento || '-'}</td>
                <td>${row.conta_contabil || '-'}</td>
                <td class="${row.vl_rateado >= 0 ? 'valor-positive' : 'valor-negative'}">
                    ${this.formatCurrency(row.vl_rateado)}
                </td>
                <td>
                    <span class="badge ${row.tipo === 'DEBITO' ? 'bg-danger' : 'bg-success'}">
                        ${row.tipo || '-'}
                    </span>
                </td>
                <td title="${(row.historico_contabil || '').replace(/"/g, '&quot;')}">
                    ${this.truncateText(row.historico_contabil || '-', 50)}
                </td>
            </tr>
        `).join('');

        this.updatePagination(this.currentTableData.length);

        // Adicionar eventos de clique para drill-down
        this.addRowInteractionEvents();
    }

    // Métodos para gráficos interativos
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadSummaryData(),
                this.loadDepartmentData(),
                this.loadDetailedData(),
                this.loadDRELines(),
                this.loadMonthlyData()
            ]);
            
            // Adicionar gráficos interativos adicionais
            await this.loadComparisonData();
            await this.loadTrendAnalysis();
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            this.showError('Falha ao carregar dados iniciais');
        }
    }

    async loadComparisonData() {
        try {
            console.log('🔄 [Comparison] Carregando dados de comparação...');
            const queryString = this.buildQueryString();
            const response = await fetch('/api/dre/comparacao?' + queryString);
            const data = await response.json();

            this.renderComparisonChart(data);
        } catch (error) {
            console.error('Erro ao carregar dados de comparação:', error);
        }
    }

    async loadTrendAnalysis() {
        try {
            console.log('🔄 [Trend] Carregando análise de tendências...');
            const queryString = this.buildQueryString();
            const response = await fetch('/api/dre/tendencias?' + queryString);
            const data = await response.json();

            this.renderTrendChart(data);
        } catch (error) {
            console.error('Erro ao carregar análise de tendências:', error);
        }
    }

    updateDepartmentChart(data) {
        const ctx = document.getElementById('deptoChart').getContext('2d');
        
        if (this.deptoChart) {
            this.deptoChart.destroy();
        }

        // Pegar top 10 departamentos
        const topData = data.slice(0, 10);
        
        // Determinar configurações responsivas
        const isMobile = window.innerWidth < 576;
        const isTablet = window.innerWidth >= 576 && window.innerWidth < 768;
        
        // Preparar dados para gráfico interativo
        const labels = topData.map(item => item.departamento);
        const receitas = topData.map(item => {
            const valor = parseFloat(item.valor_total || 0);
            return valor > 0 ? valor : 0;
        });
        const despesas = topData.map(item => {
            const valor = parseFloat(item.valor_total || 0);
            return valor < 0 ? Math.abs(valor) : 0;
        });

        this.deptoChart = new Chart(ctx, {
            type: isMobile ? 'doughnut' : 'bar',
            data: {
                labels: labels,
                datasets: isMobile ? [{
                    data: topData.map(item => Math.abs(item.valor_total || 0)),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }] : [
                    {
                        label: 'Receitas',
                        data: receitas,
                        backgroundColor: 'rgba(40, 167, 69, 0.8)',
                        borderColor: '#28a745',
                        borderWidth: 2,
                        hoverBackgroundColor: 'rgba(40, 167, 69, 1)'
                    },
                    {
                        label: 'Despesas',
                        data: despesas,
                        backgroundColor: 'rgba(220, 53, 69, 0.8)',
                        borderColor: '#dc3545',
                        borderWidth: 2,
                        hoverBackgroundColor: 'rgba(220, 53, 69, 1)'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: isMobile ? 1 : isTablet ? 1.5 : 2,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const dept = labels[dataIndex];
                        this.drillDownByDepartment(dept);
                    }
                },
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'top',
                        onClick: (e, legendItem, legend) => {
                            if (!isMobile) {
                                const index = legendItem.datasetIndex;
                                const chart = legend.chart;
                                const meta = chart.getDatasetMeta(index);
                                meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                                chart.update();
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y || context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${context.dataset.label}: ${this.formatCurrency(value)} (${percentage}%)`;
                            },
                            afterBody: (context) => {
                                const dataIndex = context[0].dataIndex;
                                const dept = labels[dataIndex];
                                const deptData = topData[dataIndex];
                                return `Lançamentos: ${deptData.quantidade_lancamentos || 0}`;
                            }
                        }
                    }
                },
                scales: isMobile ? {} : {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => this.formatCurrency(value, true)
                        }
                    }
                }
            }
        });
    }

    updateMonthlyChart(data) {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        
        if (this.monthlyChart) {
            this.monthlyChart.destroy();
        }

        // Determinar configurações responsivas
        const isMobile = window.innerWidth < 576;
        const isTablet = window.innerWidth >= 576 && window.innerWidth < 768;

        // Formatar labels dos meses
        const formattedLabels = data.labels.map(mes => {
            const [ano, mesNum] = mes.split('-');
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return isMobile ? `${meses[parseInt(mesNum) - 1]}` : `${meses[parseInt(mesNum) - 1]}/${ano}`;
        });

        // Calcular linha de tendência
        const lucroData = data.datasets.find(dataset => 
            dataset.label.includes('Resultado Operacional')
        )?.data || [];
        const trendData = this.calculateTrendLine(lucroData);

        this.monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: formattedLabels,
                datasets: [
                    ...data.datasets.map(dataset => ({
                        ...dataset,
                        fill: false,
                        tension: 0.2,
                        pointRadius: isMobile ? 2 : 3,
                        pointHoverRadius: isMobile ? 3 : 5,
                        borderWidth: isMobile ? 1.5 : 2
                    })),
                    {
                        label: 'Tendência',
                        data: trendData,
                        borderColor: '#ffc107',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                aspectRatio: isMobile ? 1.5 : isTablet ? 2 : 3,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const month = data.labels[dataIndex];
                        this.drillDownByMonth(month);
                    }
                },
                plugins: {
                    legend: {
                        position: isMobile ? 'bottom' : 'top',
                        onClick: (e, legendItem, legend) => {
                            const index = legendItem.datasetIndex;
                            const chart = legend.chart;
                            const meta = chart.getDatasetMeta(index);
                            meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                            chart.update();
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => this.formatCurrency(value, true)
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    renderComparisonChart(data) {
        // Verificar se existe container para gráfico de comparação
        let container = document.getElementById('comparisonChartContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'comparisonChartContainer';
            container.className = 'col-12 mb-4';
            
            const chartSection = document.createElement('section');
            chartSection.className = 'row';
            chartSection.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">
                                <i class="fas fa-chart-bar me-2"></i>Comparação Período vs Anterior
                            </h5>
                        </div>
                        <div class="card-body">
                            <canvas id="comparisonChart" height="120"></canvas>
                            <div class="chart-description"></div>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(chartSection);
            
            // Inserir antes da tabela detalhada
            const detailedTableSection = document.querySelector('.card:has(#dataTable)').closest('.row');
            if (detailedTableSection) {
                detailedTableSection.parentNode.insertBefore(container, detailedTableSection);
            }
        }

        const ctx = document.getElementById('comparisonChart').getContext('2d');
        
        if (this.comparisonChart) {
            this.comparisonChart.destroy();
        }

        const labels = Object.keys(data.periodo_atual || {});
        const atualData = Object.values(data.periodo_atual || {});
        const anteriorData = Object.values(data.periodo_anterior || {});
        const variacoes = Object.values(data.variacoes || {});

        this.comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Período Atual',
                        data: atualData,
                        backgroundColor: 'rgba(0, 123, 255, 0.8)',
                        borderColor: '#007bff',
                        borderWidth: 2
                    },
                    {
                        label: 'Período Anterior',
                        data: anteriorData,
                        backgroundColor: 'rgba(108, 117, 125, 0.8)',
                        borderColor: '#6c757d',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const linhaDRE = labels[dataIndex];
                        this.drillDownByLinhaDRE(linhaDRE);
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y;
                                return `${context.dataset.label}: ${this.formatCurrency(value)}`;
                            },
                            afterBody: (context) => {
                                const dataIndex = context[0].dataIndex;
                                const variacao = variacoes[dataIndex];
                                const textoVariacao = variacao >= 0 ? '+' : '';
                                return `Variação: ${textoVariacao}${this.formatCurrency(variacao)}`;
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
                    }
                }
            }
        });

        // Adicionar descrição para acessibilidade
        const description = container.querySelector('.chart-description');
        if (description) {
            description.textContent = 'Gráfico comparando período atual vs anterior. Clique em uma barra para detalhes.';
        }
    }

    renderTrendChart(data) {
        // Criar gráfico de tendências separadamente se ainda não existir
        let container = document.getElementById('trendChartContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'trendChartContainer';
            container.className = 'col-12 mb-4';
            
            const chartSection = document.createElement('section');
            chartSection.className = 'row';
            chartSection.innerHTML = `
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">
                                <i class="fas fa-chart-line me-2"></i>Análise de Tendências
                                <button id="toggleTrend" class="btn btn-sm btn-outline-primary ms-2">
                                    <i class="fas fa-chart-line"></i> Mostrar Tendência
                                </button>
                            </h5>
                        </div>
                        <div class="card-body">
                            <canvas id="trendChart" height="150"></canvas>
                            <div class="chart-controls mt-3" style="display: none;">
                                <button class="btn btn-sm btn-outline-secondary" id="trend30">30 dias</button>
                                <button class="btn btn-sm btn-outline-secondary" id="trend60">60 dias</button>
                                <button class="btn btn-sm btn-outline-secondary" id="trend90">90 dias</button>
                            </div>
                            <div class="chart-description"></div>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(chartSection);
            
            // Inserir após o gráfico mensal
            const monthlyChartSection = document.getElementById('monthlyChart')?.closest('.row');
            if (monthlyChartSection && monthlyChartSection.nextSibling) {
                monthlyChartSection.parentNode.insertBefore(container, monthlyChartSection.nextSibling);
            }
        }

        const ctx = document.getElementById('trendChart').getContext('2d');
        
        if (this.trendChart) {
            this.trendChart.destroy();
        }

        // Calcular médias móveis
        const media7dias = this.calculateMovingAverage(data.valores, 7);
        const media30dias = this.calculateMovingAverage(data.valores, 30);

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.datas,
                datasets: [
                    {
                        label: 'Valor Diário',
                        data: data.valores,
                        borderColor: 'rgba(0, 123, 255, 0.3)',
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false,
                        tension: 0
                    },
                    {
                        label: 'Média 7 dias',
                        data: media7dias,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.2
                    },
                    {
                        label: 'Média 30 dias',
                        data: media30dias,
                        borderColor: '#ffc107',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.2,
                        hidden: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => this.formatCurrency(value, true)
                        }
                    }
                }
            }
        });

        // Adicionar evento para alternar tendência
        const toggleBtn = container.querySelector('#toggleTrend');
        const controls = container.querySelector('.chart-controls');
        
        if (toggleBtn && controls) {
            toggleBtn.addEventListener('click', () => {
                controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
                toggleBtn.innerHTML = controls.style.display === 'none' 
                    ? '<i class="fas fa-chart-line"></i> Mostrar Tendência'
                    : '<i class="fas fa-chart-line"></i> Esconder Tendência';
            });
        }

        // Adicionar descrição para acessibilidade
        const description = container.querySelector('.chart-description');
        if (description) {
            description.textContent = 'Análise de tendências com médias móveis. Use botões para diferentes períodos.';
        }
    }

    calculateTrendLine(data) {
        const n = data.length;
        if (n === 0) return [];
        
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += data[i];
            sumXY += i * data[i];
            sumX2 += i * i;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return Array.from({ length: n }, (_, i) => slope * i + intercept);
    }

    calculateMovingAverage(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - period + 1);
            const end = i + 1;
            const subset = data.slice(start, end);
            const avg = subset.reduce((sum, val) => sum + val, 0) / subset.length;
            result.push(avg);
        }
        return result;
    }

    addRowInteractionEvents() {
        document.querySelectorAll('.table-row-hover').forEach(row => {
            // Evento de clique
            row.addEventListener('click', () => {
                try {
                    const rowData = JSON.parse(row.dataset.row.replace(/&apos;/g, "'"));
                    this.showRowDetails(rowData);
                } catch (error) {
                    console.error('Erro ao processar dados da linha:', error);
                }
            });

            // Eventos de teclado para acessibilidade
            row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    row.click();
                }
            });
        });
    }

    showRowDetails(rowData) {
        // Anunciar para leitores de tela
        const announcements = document.getElementById('announcements');
        if (announcements) {
            announcements.textContent = `Detalhes: ${rowData.historico_contabil} - ${this.formatCurrency(rowData.vl_rateado)}`;
        }

        // Criar modal de detalhes (simplificado)
        const modalHtml = `
            <div class="modal fade" id="rowDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Detalhes do Lançamento</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <strong>Data:</strong> ${this.formatDate(rowData.data)}<br>
                                    <strong>Departamento:</strong> ${rowData.departamento || '-'}<br>
                                    <strong>Linha DRE:</strong> ${rowData.linha_dre || '-'}<br>
                                    <strong>Conta Contábil:</strong> ${rowData.conta_contabil || '-'}
                                </div>
                                <div class="col-md-6">
                                    <strong>Valor:</strong> <span class="${rowData.vl_rateado >= 0 ? 'valor-positive' : 'valor-negative'}">${this.formatCurrency(rowData.vl_rateado)}</span><br>
                                    <strong>Tipo:</strong> <span class="badge ${rowData.tipo === 'DEBITO' ? 'bg-danger' : 'bg-success'}">${rowData.tipo || '-'}</span><br>
                                    <strong>Origem:</strong> ${rowData.origem_lanc || '-'}<br>
                                    <strong>Código:</strong> ${rowData.codigo_lanc || '-'}
                                </div>
                            </div>
                            <hr>
                            <p><strong>Histórico:</strong><br>${rowData.historico_contabil || '-'}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fechar</button>
                            <button type="button" class="btn btn-primary" onclick="dashboard.drillDownByRow(${JSON.stringify(rowData).replace(/"/g, '&quot;')})">
                                <i class="fas fa-search-plus me-2"></i>Detalhar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remover modal anterior se existir
        const existingModal = document.getElementById('rowDetailModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Adicionar novo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = new bootstrap.Modal(document.getElementById('rowDetailModal'));
        modal.show();

        // Remover modal do DOM quando for fechado
        document.getElementById('rowDetailModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('rowDetailModal').remove();
        });
    }

    drillDownByDepartment(department) {
        console.log(`Drill-down solicitado para departamento: ${department}`);
        
        const announcements = document.getElementById('announcements');
        if (announcements) {
            announcements.textContent = `Filtrando por departamento: ${department}`;
        }
        
        document.getElementById('departamento').value = department;
        this.applyFilters();
        
        setTimeout(() => {
            document.getElementById('dataTable')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
    }

    drillDownByMonth(month) {
        console.log(`Drill-down solicitado para mês: ${month}`);
        
        const announcements = document.getElementById('announcements');
        if (announcements) {
            announcements.textContent = `Filtrando por mês: ${month}`;
        }
        
        const date = new Date(month);
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        document.getElementById('dataInicio').value = firstDay.toISOString().split('T')[0];
        document.getElementById('dataFim').value = lastDay.toISOString().split('T')[0];
        
        this.applyFilters();
        
        setTimeout(() => {
            document.getElementById('dataTable')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
    }

    drillDownByLinhaDRE(linhaDRE) {
        console.log(`Drill-down solicitado para linha DRE: ${linhaDRE}`);
        
        const announcements = document.getElementById('announcements');
        if (announcements) {
            announcements.textContent = `Filtrando por linha DRE: ${linhaDRE}`;
        }
        
        document.getElementById('linhaDRE').value = linhaDRE;
        this.applyFilters();
        
        setTimeout(() => {
            document.getElementById('dataTable')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
    }

    drillDownByRow(rowData) {
        console.log(`Drill-down solicitado para lançamento:`, rowData);
        
        // Fechar modal primeiro
        const modal = bootstrap.Modal.getInstance(document.getElementById('rowDetailModal'));
        if (modal) {
            modal.hide();
        }
        
        // Abrir tela de detalhes completa (em produção, seria uma página separada)
        this.showSuccess(`Abrindo detalhes completos do lançamento ${rowData.codigo_lanc || 'sem código'}`);
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    // Métodos para busca avançada
    performSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput?.value?.trim();
        
        if (!searchTerm) {
            this.showToast('Digite um termo para buscar', 'warning');
            return;
        }

        console.log('🔍 [Search] Realizando busca:', searchTerm);
        
        // Adicionar aos filtros atuais
        this.currentFilters.search = searchTerm;
        
        // Realizar busca
        this.searchData(searchTerm);
        
        // Anunciar para leitores de tela
        const announcements = document.getElementById('announcements');
        if (announcements) {
            announcements.textContent = `Buscando por: ${searchTerm}`;
        }
        
        // Atualizar UI
        this.updateSearchUI(searchTerm);
    }

    async searchData(searchTerm) {
        try {
            this.showLoading();
            
            // Construir query string para endpoint de busca dedicado
            const params = new URLSearchParams();
            params.append('search', searchTerm);
            
            // Adicionar filtros existentes
            Object.entries(this.currentFilters).forEach(([key, value]) => {
                if (value && key !== 'search') {
                    params.append(key, value);
                }
            });
            
            console.log('🔍 [Search] Query:', params.toString());
            const startTime = performance.now();
            
            const response = await fetch(`/api/dre/search?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro na busca');
            }
            
            const data = await response.json();
            
            const endTime = performance.now();
            console.log(`✅ [Search] Busca concluída em ${(endTime - startTime).toFixed(2)}ms`, data);

            // Atualizar tabela com resultados
            this.currentTableData = data.data || [];
            this.displayTableData();
            
            // Atualizar cards resumo se vierem na resposta
            if (data.summary) {
                this.updateSummaryCards(data.summary);
            }
            
            // Mostrar resultados encontrados com informações detalhadas
            const resultsCount = data.data?.length || 0;
            const totalCount = data.search?.total_count || 0;
            const searchType = data.search?.type || 'fulltext';
            const queryTime = data.performance?.queryTime || 0;
            
            let message = `Encontrados ${resultsCount}`;
            if (resultsCount < totalCount) {
                message += ` de ${totalCount}`;
            }
            message += ` resultados para "${searchTerm}"`;
            
            if (searchType === 'numeric') {
                message += ` (busca numérica)`;
            }
            
            message += ` (${queryTime.toFixed(0)}ms)`;
            
            this.showSuccess(message);
            
            // Rolar para a tabela
            setTimeout(() => {
                document.getElementById('dataTable')?.scrollIntoView({ behavior: 'smooth' });
            }, 500);

        } catch (error) {
            console.error('❌ [Search] Erro na busca:', error);
            this.showToast(
                error.message || 'Erro ao realizar busca. Tente novamente.', 
                'danger'
            );
        } finally {
            this.hideLoading();
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Remover filtro de busca
        delete this.currentFilters.search;
        
        // Recarregar dados com filtros atuais (sem busca)
        this.applyFilters();
        
        // Esconder sugestões
        this.hideSearchSuggestions();
        
        // Resetar UI
        this.updateSearchUI('');
        
        console.log('🧹 [Search] Busca limpa');
    }

    saveCurrentSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchTerm = searchInput?.value?.trim();
        
        if (!searchTerm) {
            this.showToast('Não há busca para salvar', 'warning');
            return;
        }

        // Salvar no localStorage
        const savedSearches = JSON.parse(localStorage.getItem('savedSearches') || '[]');
        
        // Verificar se já existe
        const existingIndex = savedSearches.indexOf(searchTerm);
        if (existingIndex > -1) {
            savedSearches.splice(existingIndex, 1);
        }
        
        // Adicionar ao início
        savedSearches.unshift(searchTerm);
        
        // Manter apenas as 10 buscas mais recentes
        savedSearches.splice(10);
        
        localStorage.setItem('savedSearches', JSON.stringify(savedSearches));
        
        this.showSuccess('Busca salva com sucesso!');
        this.updateSavedSearches();
        
        console.log('💾 [Search] Busca salva:', searchTerm);
    }

    updateSavedSearches() {
        const savedSearches = JSON.parse(localStorage.getItem('savedSearches') || '[]');
        
        // Atualizar sugestões
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (suggestionsContainer && savedSearches.length > 0) {
            const recentSearchesHTML = savedSearches.map(search => 
                `<span class="badge bg-light text-dark search-suggestion me-1" data-search="${search}">${search}</span>`
            ).join('');
            
            // Adicionar após as sugestões padrão
            const recentSearchesDiv = suggestionsContainer.querySelector('.alert-info .d-flex');
            if (recentSearchesDiv) {
                // Adicionar título para buscas recentes
                if (!suggestionsContainer.querySelector('.recent-searches-title')) {
                    recentSearchesDiv.insertAdjacentHTML('beforebegin', `
                        <small class="mt-2 d-block">
                            <i class="fas fa-history me-1"></i>
                            <strong>Buscas recentes:</strong>
                        </small>
                    `);
                }
                
                // Adicionar ou atualizar buscas recentes
                let recentSearchesContainer = suggestionsContainer.querySelector('.recent-searches');
                if (!recentSearchesContainer) {
                    recentSearchesDiv.insertAdjacentHTML('afterend', `
                        <div class="d-flex flex-wrap gap-1 mt-2 recent-searches">${recentSearchesHTML}</div>
                    `);
                } else {
                    recentSearchesContainer.innerHTML = recentSearchesHTML;
                }
                
                // Adicionar evento clique nas novas sugestões
                suggestionsContainer.querySelectorAll('.recent-searches .search-suggestion').forEach(suggestion => {
                    suggestion.addEventListener('click', () => {
                        const searchValue = suggestion.dataset.search;
                        document.getElementById('searchInput').value = searchValue;
                        this.performSearch();
                    });
                });
            }
        }
    }

    applyQuickFilter(filter) {
        console.log('⚡ [QuickFilter] Aplicando filtro rápido:', filter);
        
        // Resetar filtros
        this.clearFilters(false); // Não limpar busca
        
        // Aplicar filtro específico
        switch (filter) {
            case 'receitas':
                this.currentFilters.tipo = 'CREDITO';
                this.currentFilters.search = 'vl_rateado > 0';
                break;
                
            case 'despesas':
                this.currentFilters.tipo = 'DEBITO';
                this.currentFilters.search = 'vl_rateado < 0';
                break;
                
            case 'maiores_receitas':
                this.currentFilters.tipo = 'CREDITO';
                this.currentFilters.search = 'vl_rateado > 0';
                this.currentFilters.sort = 'vl_rateado desc';
                this.currentFilters.limit = 20;
                break;
                
            case 'maiores_despesas':
                this.currentFilters.tipo = 'DEBITO';
                this.currentFilters.search = 'vl_rateado < 0';
                this.currentFilters.sort = 'vl_rateado asc';
                this.currentFilters.limit = 20;
                break;
                
            case 'ultimos_lancamentos':
                this.currentFilters.sort = 'data desc';
                this.currentFilters.limit = 50;
                break;
                
            case 'lancamentos_negativos':
                this.currentFilters.search = 'vl_rateado < -1000';
                this.currentFilters.sort = 'vl_rateado asc';
                this.currentFilters.limit = 30;
                break;
        }
        
        // Atualizar UI
        document.getElementById('searchInput').value = this.currentFilters.search || '';
        
        // Aplicar filtros
        this.loadDetailedData();
        
        // Anunciar
        const announcements = document.getElementById('announcements');
        if (announcements) {
            announcements.textContent = `Filtro rápido aplicado: ${filter}`;
        }
        
        // Feedback visual
        this.showSuccess(`Filtro "${filter}" aplicado!`, 'success');
    }

    showSearchSuggestions(searchTerm) {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (!suggestionsContainer) return;
        
        // Se houver termo, buscar sugestões dinâmicas
        if (searchTerm && searchTerm.length >= 2) {
            this.fetchDynamicSuggestions(searchTerm);
        }
        
        // Mostrar container
        suggestionsContainer.style.display = 'block';
        
        // Adicionar event listeners se ainda não existirem
        if (!suggestionsContainer.hasAttribute('data-listeners')) {
            suggestionsContainer.setAttribute('data-listeners', 'true');
            
            // Adicionar listeners a todas as sugestões
            suggestionsContainer.querySelectorAll('.search-suggestion').forEach(suggestion => {
                suggestion.addEventListener('click', () => {
                    const searchValue = suggestion.dataset.search;
                    document.getElementById('searchInput').value = searchValue;
                    this.performSearch();
                });
            });
        }
    }

    hideSearchSuggestions() {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        if (suggestionsContainer) {
            suggestionsContainer.style.display = 'none';
        }
    }

    async fetchDynamicSuggestions(searchTerm) {
        try {
            const response = await fetch(`/api/dre/suggestions?q=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) {
                throw new Error('Erro ao buscar sugestões');
            }
            const suggestions = await response.json();
            
            if (suggestions && suggestions.length > 0) {
                // Atualizar sugestões dinâmicas
                this.updateDynamicSuggestions(suggestions);
                console.log(`🔍 [Suggestions] ${suggestions.length} sugestões encontradas para "${searchTerm}"`);
            }
        } catch (error) {
            console.log('Não foi possível buscar sugestões dinâmicas:', error);
        }
    }

    updateDynamicSuggestions(suggestions) {
        const container = document.getElementById('searchSuggestions');
        if (!container) return;
        
        // Criar seção de sugestões dinâmicas
        let dynamicSection = container.querySelector('.dynamic-suggestions');
        if (!dynamicSection) {
            container.querySelector('.alert-info').insertAdjacentHTML('beforeend', `
                <div class="dynamic-suggestions mt-2">
                    <small class="d-block">
                        <i class="fas fa-magic me-1"></i>
                        <strong>Sugestões:</strong>
                    </small>
                    <div class="d-flex flex-wrap gap-1 mt-2"></div>
                </div>
            `);
            dynamicSection = container.querySelector('.dynamic-suggestions');
        }
        
        // Atualizar conteúdo
        const dynamicBadges = suggestions.map(suggestion => 
            `<span class="badge bg-light text-dark search-suggestion me-1" data-search="${suggestion}">${suggestion}</span>`
        ).join('');
        
        dynamicSection.querySelector('.d-flex').innerHTML = dynamicBadges;
        
        // Adicionar listeners
        dynamicSection.querySelectorAll('.search-suggestion').forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                const searchValue = suggestion.dataset.search;
                document.getElementById('searchInput').value = searchValue;
                this.performSearch();
            });
        });
    }

    updateSearchUI(searchTerm) {
        // Atualizar estado visual dos botões
        const searchBtn = document.getElementById('searchBtn');
        const clearSearchBtn = document.getElementById('clearSearch');
        
        if (searchBtn) {
            searchBtn.disabled = !searchTerm;
            searchBtn.classList.toggle('btn-outline-primary', !searchTerm);
            searchBtn.classList.toggle('btn-primary', !!searchTerm);
        }
        
        if (clearSearchBtn) {
            clearSearchBtn.disabled = !searchTerm;
            clearSearchBtn.style.display = searchTerm ? 'block' : 'none';
        }
        
        // Atualizar placeholder se necessário
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchTerm) {
            searchInput.classList.add('border-primary');
            searchInput.setAttribute('aria-label', `Busca atual: ${searchTerm}`);
        } else if (searchInput) {
            searchInput.classList.remove('border-primary');
            searchInput.setAttribute('aria-label', 'Busca avançada');
        }
    }

    toggleFiltersPanel() {
        const filterCardBody = document.getElementById('filterCardBody');
        const toggleBtn = document.getElementById('toggleFilters');
        const toggleIcon = toggleBtn?.querySelector('i');
        
        if (filterCardBody) {
            const isHidden = filterCardBody.style.display === 'none';
            
            filterCardBody.style.display = isHidden ? 'block' : 'none';
            
            // Atualizar ícone
            if (toggleIcon) {
                toggleIcon.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
            }
            
            // Atualizar tooltip
            if (toggleBtn) {
                toggleBtn.title = isHidden ? 'Expandir/Contrair filtros' : 'Expandir/Contrair filtros';
            }
            
            // Salvar preferência
            localStorage.setItem('filtersCollapsed', !isHidden);
            
            console.log('🔄 [Filters] Painel de filtros:', isHidden ? 'expandido' : 'contraído');
        }
    }

    hideLoading() {
        // Esconder loading states
        document.querySelectorAll('.spinner-border').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// Inicializar dashboard quando DOM estiver pronto
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new DREDashboard();
});

// Expor para uso global (para os links de paginação)
window.dashboard = dashboard;
