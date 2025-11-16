console.log('Iniciando 🚀🚀🚀');
import cfonts from 'cfonts';
import chalk from 'chalk';

// Detectar dimensiones de la consola
const getConsoleSize = () => {
  const columns = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  return { columns, rows };
};

// Determinar configuración según tamaño de consola
const getResponsiveConfig = () => {
  const { columns } = getConsoleSize();
  
  // Consola muy pequeña (móvil, terminal estrecho)
  if (columns < 50) {
    return {
      titleFont: 'tiny',
      subtitleFont: 'console',
      space: false,
      maxLength: 0
    };
  }
  // Consola pequeña
  else if (columns < 80) {
    return {
      titleFont: 'block',
      subtitleFont: 'console',
      space: true,
      maxLength: 0
    };
  }
  // Consola mediana
  else if (columns < 120) {
    return {
      titleFont: 'chrome',
      subtitleFont: 'console',
      space: true,
      maxLength: 0
    };
  }
  // Consola grande
  else {
    return {
      titleFont: 'chrome',
      subtitleFont: 'console',
      space: true,
      maxLength: 0
    };
  }
};

// Función para mostrar el banner adaptativo
const showBanner = () => {
  const config = getResponsiveConfig();
  const { columns } = getConsoleSize();
  
  try {
    // Título principal
    cfonts.say('MULTIJUEGOS-BOT', {
      font: config.titleFont,
      align: 'center',
      gradient: ['red', 'magenta'],
      transition: false,
      space: config.space,
      maxLength: config.maxLength,
      env: 'node'
    });

    // Subtítulo
    cfonts.say('by: multijuegos', {
      font: config.subtitleFont,
      align: 'center',
      gradient: ['red', 'magenta'],
      transition: false,
      env: 'node'
    });

    // Información adicional (opcional)
    const separator = '─'.repeat(Math.min(columns - 4, 60));
    console.log(chalk.gray(`\n  ${separator}`));
    console.log(chalk.cyan(`  Terminal: ${columns}x${process.stdout.rows || 24}`));
    console.log(chalk.gray(`  ${separator}\n`));
    
  } catch (error) {
    // Fallback en caso de error
    console.log(chalk.bold.red('\n  MULTIJUEGOS-BOT'));
    console.log(chalk.magenta('  by: multijuegos\n'));
  }
};

// Mostrar banner
showBanner();

// Escuchar cambios de tamaño de consola
process.stdout.on('resize', () => {
  console.clear();
  console.log('Iniciando 🚀🚀🚀');
  showBanner();
});

// Importar módulo principal
import('./main.js');