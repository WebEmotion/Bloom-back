import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm'
import { Booking } from './Bookings'
import { Room } from './Rooms'

@Entity({name: 'seats'})
export class Seat {
    @PrimaryGeneratedColumn('increment', {comment: "Identificador numérico del asiento"})
    id: number

    @Column({comment: "Número del asiento"})
    number: string

    @Column({default: true, comment: "Bandera que indica si la clase es publica o privada"})
    isActive: boolean

    @OneToMany(type => Booking, Booking => Booking.Seat)
    Booking?: Booking

    @ManyToOne(type => Room, Room => Room.Seat)
    @JoinColumn({name: 'rooms_id'})
    Room: Room

}
