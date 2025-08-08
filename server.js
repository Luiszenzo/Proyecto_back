const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Console logs para verificar configuración
console.log('🔧 Configurando Supabase...');
console.log('📍 Supabase URL:', supabaseUrl ? '✅ Configurada' : '❌ No encontrada');
console.log('🔑 Supabase Key:', supabaseKey ? '✅ Configurada' : '❌ No encontrada');

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('🚀 Cliente de Supabase creado exitosamente');

// Middleware
app.use(cors());
app.use(express.json());
console.log('⚙️ Middleware configurado (CORS y JSON)');

// Función para verificar conexión con Supabase
async function testSupabaseConnection() {
  try {
    console.log('🔍 Probando conexión con Supabase...');
    const { data, error } = await supabase
      .from('packages')
      .select('count', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Error al conectar con Supabase:', error.message);
    } else {
      console.log('✅ Conexión con Supabase exitosa');
      console.log('📊 Tablas accesibles');
    }
  } catch (err) {
    console.log('❌ Error de conexión:', err.message);
  }
}

// ==================== RUTAS DE SALUD ====================
app.get('/api/health', (req, res) => {
  console.log('🏥 Endpoint /api/health consultado');
  res.json({ 
    message: 'Backend funcionando correctamente', 
    supabase: !!supabase,
    timestamp: new Date().toISOString()
  });
});

// ==================== RUTAS DE REPARTIDORES ====================

// Obtener todos los repartidores
// Eliminar esta ruta duplicada (líneas 58-77)
// app.get('/api/deliveries', async (req, res) => {
//   console.log('🚚 Consultando repartidores...');
//   try {
//     const { data, error } = await supabase
//       .from('deliveries')  // Esta tabla ya no existe
//       .select('*')
//       .order('name');
//     
//     if (error) {
//       console.log('❌ Error al obtener repartidores:', error.message);
//       return res.status(400).json({ error: error.message });
//     }
//     
//     console.log(`✅ ${data.length} repartidores encontrados`);
//     res.json(data);
//   } catch (err) {
//     console.log('❌ Error interno:', err.message);
//     res.status(500).json({ error: 'Error interno del servidor' });
//   }
// });

// Crear nuevo repartidor
app.post('/api/deliveries', async (req, res) => {
  console.log('➕ Creando nuevo repartidor...');
  try {
    const { name, phone, email } = req.body;
    
    const { data, error } = await supabase
      .from('deliveries')
      .insert([{ name, phone, email }])
      .select();
    
    if (error) {
      console.log('❌ Error al crear repartidor:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    console.log('✅ Repartidor creado:', data[0].name);
    res.status(201).json(data[0]);
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== RUTAS DE PAQUETES ====================

// Obtener todos los paquetes con información del repartidor
app.get('/api/packages', async (req, res) => {
  console.log('📦 Consultando paquetes...');
  try {
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        usuarios!packages_delivery_person_id_fkey (
          id,
          name,
          phone,
          status
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.log('❌ Error al obtener paquetes:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    // Formatear los datos para incluir el nombre del repartidor
    const formattedData = data.map(pkg => ({
      ...pkg,
      delivery_name: pkg.usuarios?.name || 'No asignado',
      delivery_phone: pkg.usuarios?.phone || null,
      delivery_status: pkg.usuarios?.status || null
    }));
    
    console.log(`✅ ${data.length} paquetes encontrados`);
    res.json(formattedData);
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nuevo paquete
app.post('/api/packages', async (req, res) => {
  console.log('➕ Creando nuevo paquete...');
  try {
    const { destinatario, direccion, delivery_id } = req.body;
    
    if (!destinatario || !direccion || !delivery_id) {
      return res.status(400).json({ 
        error: 'Faltan campos requeridos: destinatario, direccion, delivery_id' 
      });
    }
    
    const { data, error } = await supabase
      .from('packages')
      .insert([{ 
        destinatario, 
        direccion, 
        delivery_person_id: delivery_id,  // Cambiar aquí
        status: 'pending'
      }])
      .select(`
        *,
        usuarios!packages_delivery_person_id_fkey (
          id,
          name,
          phone
        )
      `);
    
    if (error) {
      console.log('❌ Error al crear paquete:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    const formattedData = {
      ...data[0],
      delivery_name: data[0].usuarios?.name || 'No asignado'
    };
    
    console.log('✅ Paquete creado para:', destinatario);
    res.status(201).json(formattedData);
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener paquete específico
app.get('/api/packages/:id', async (req, res) => {
  console.log('🔍 Consultando paquete específico...');
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        deliveries!packages_delivery_id_fkey (
          id,
          name,
          phone,
          status
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      console.log('❌ Error al obtener paquete:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    const formattedData = {
      ...data,
      delivery_name: data.deliveries?.name || 'No asignado'
    };
    
    console.log('✅ Paquete encontrado:', data.destinatario);
    res.json(formattedData);
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar estado del paquete
app.put('/api/packages/:id/status', async (req, res) => {
  console.log('🔄 Actualizando estado del paquete...');
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'in_transit', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: 'Estado inválido. Debe ser: pending, in_transit, delivered, cancelled' 
      });
    }
    
    const updateData = { status };
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('packages')
      .update(updateData)
      .eq('id', id)
      .select();
    
    if (error) {
      console.log('❌ Error al actualizar estado:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    console.log(`✅ Estado actualizado a: ${status}`);
    res.json(data[0]);
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Actualizar paquete completo
app.put('/api/packages/:id', async (req, res) => {
  console.log('🔄 Actualizando paquete completo...');
  try {
    const { id } = req.params;
    const { destinatario, direccion, delivery_id, status } = req.body;
    
    const { data, error } = await supabase
      .from('packages')
      .update({ destinatario, direccion, delivery_id, status })
      .eq('id', id)
      .select(`
        *,
        deliveries!packages_delivery_id_fkey (
          id,
          name,
          phone
        )
      `);
    
    if (error) {
      console.log('❌ Error al actualizar paquete:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    const formattedData = {
      ...data[0],
      delivery_name: data[0].deliveries?.name || 'No asignado'
    };
    
    console.log('✅ Paquete actualizado:', destinatario);
    res.json(formattedData);
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar paquete
app.delete('/api/packages/:id', async (req, res) => {
  console.log('🗑️ Eliminando paquete...');
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('packages')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log('❌ Error al eliminar paquete:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    console.log('✅ Paquete eliminado exitosamente');
    res.status(204).send();
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== RUTAS LEGACY (para compatibilidad) ====================

// Obtener datos del mapa (mantener compatibilidad)
app.get('/api/map-data', async (req, res) => {
  console.log('🗺️ Consultando datos del mapa (legacy)...');
  try {
    const { data, error } = await supabase
      .from('packages')
      .select(`
        *,
        deliveries!packages_delivery_id_fkey (
          name,
          phone
        )
      `)
      .eq('status', 'in_transit'); // Solo paquetes en tránsito para el mapa
    
    if (error) {
      console.log('❌ Error al obtener datos del mapa:', error.message);
      return res.status(400).json({ error: error.message });
    }
    
    console.log(`✅ ${data.length} paquetes en tránsito encontrados`);
    res.json(data);
  } catch (err) {
    console.log('❌ Error interno:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener ubicaciones (mantener compatibilidad)
app.get('/api/locations', async (req, res) => {
  console.log('📍 Consultando ubicaciones (legacy)...');
  // Redirigir a paquetes
  res.redirect('/api/packages');
});

// ==================== INICIAR SERVIDOR ====================

app.listen(port, async () => {
  console.log('🎉 ================================');
  console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
  console.log('🎉 ================================');
  console.log('📋 Endpoints disponibles:');
  console.log('   🏥 GET  /api/health');
  console.log('   🚚 GET  /api/deliveries');
  console.log('   🚚 POST /api/deliveries');
  console.log('   📦 GET  /api/packages');
  console.log('   📦 POST /api/packages');
  console.log('   📦 GET  /api/packages/:id');
  console.log('   📦 PUT  /api/packages/:id');
  console.log('   📦 PUT  /api/packages/:id/status');
  console.log('   📦 DELETE /api/packages/:id');
  console.log('   🗺️ GET  /api/map-data (legacy)');
  console.log('   📍 GET  /api/locations (legacy)');
  console.log('🎉 ================================');
  
  // Probar conexión con Supabase al iniciar
  await testSupabaseConnection();
});

// Agregar estas rutas al server.js existente

// Ruta de login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Intento de login:', { email });
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email y contraseña son requeridos' 
      });
    }

    // Buscar usuario por email y contraseña
    const { data: user, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('password', password)
      .single();

    if (error || !user) {
      console.log('❌ Login fallido:', error?.message);
      return res.status(401).json({ 
        success: false, 
        message: 'Credenciales incorrectas' 
      });
    }

    // Remover contraseña de la respuesta
    const { password: _, ...userWithoutPassword } = user;
    
    console.log('✅ Login exitoso:', userWithoutPassword.name, userWithoutPassword.role);
    
    res.json({
      success: true,
      user: userWithoutPassword
    });
    
  } catch (error) {
    console.error('💥 Error en login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno del servidor' 
    });
  }
});

// Mantener solo esta ruta (líneas 441-465) que usa 'usuarios'
app.get('/api/deliveries', async (req, res) => {
  try {
    console.log('📋 Obteniendo usuarios repartidores...');
    
    const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('role', 'delivery');

    if (error) {
      console.error('❌ Error obteniendo repartidores:', error);
      return res.status(500).json({ error: error.message });
    }

    // Remover contraseñas de la respuesta
    const usuariosSinPassword = usuarios.map(({ password, ...user }) => user);
    
    console.log('✅ Repartidores obtenidos:', usuariosSinPassword.length);
    res.json(usuariosSinPassword);
    
  } catch (error) {
    console.error('💥 Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});