/**
 * @fileoverview Servicio principal de gestión de usuarios y estado en Supabase.
 * Proporciona métodos para interactuar con la tabla de perfiles, actualizar estadísticas,
 * gestionar el progreso académico y manipular el mapa de aprendizaje generado por la IA.
 * 
 * Este módulo actúa como una capa de abstracción sobre el cliente de Supabase,
 * unificando las operaciones de lectura y escritura de perfiles de usuario.
 */

import { supabase } from '../config/supabase.js';

const circlesManager = {
    async getCircleById(circleId){
        const{data,error} = await supabase
            .from('circles_table')
            .select('*')
            .eq('id',circleId)
            .single();
        if (error){
            console.error('Error fetching circle data (not found)',error);
            return null;
        }
        return data;
    },
    async getCirclesByOwnerAndName(userId,name){
        const{data, error} = await supabase
            .from('circles_table')
            .select('*')
            .eq('id_owner',userId)
            .eq('name',name);
        if(error){
            console.error('Error finding specific circle (either the owner or the circle name is wrong)')
            return null;
        }
        return data;
    },
    async getAllCircles(){
        const{data,error} = await supabase
            .from('circles_table')
            .select('*');
        if(error){
            console.error('Error fetching circle data (none found)',error)
            return null;
        }
        return data;
    },
    async createCircle(circleName,circleTheme,circleClassroom,circleOwner){
        const{data, error} = await supabase
            .from('circles_table')
            .insert([{
                name: circleName,
                id_theme: circleTheme,
                id_classroom: circleClassroom,
                id_owner: circleOwner
            }])
            .select();
        if(error){
            console.error('Error while inserting new circle (circle not inserted in circles_table)',error)
            return null;
        }
        return data;
    },
}
const userCriclesManager = {
    async getCirclesByUserId(userId){
        const {data,error} = await supabase
            .from('circles_table_student')
            .select('*')
            .eq('id_student',userId);
        if (error) {
            console.error('Error fetching user circle data (none found):', error);
            return null;
        }
        return data;
    },
    async createConectionCircleStudent(circleRole,circleId,studentId){
        const{data, error} =await supabase
            .from('circles_table_student')
            .insert([{
                id_circle: circleId,
                id_student: studentId,
                role: circleRole
            }])
            .select();
        if (error){
            console.error('Error while inserting new conecction (either circleId or studentId were wrong)');
            return null;
        }
        return data;
    },
    async updateRoleCircleStudent(circleId,studentId,circleRole){
        const{data,error} = await supabase
            .from('circles_table_student')
            .eq('id_student',studentId)
            .eq('id_circle',circleId)
            .update([{role: circleRole}])
            .select();
        if (error){
            console.error("Error while trying to update role (student couldn't be found)")
            return null;
        }
        return data;
    }
}